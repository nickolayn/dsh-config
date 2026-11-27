/**
 * Локальный мост для плагинов DSH: CRM отеля и TeamJet.
 *
 * Зачем: страницы плагинов живут в браузере DSH (http://127.0.0.1:<порт>),
 * поэтому читать чужие API напрямую им мешает CORS, а логин/токен держать
 * в браузерном коде нельзя. Мост — единственное место, где есть сеть и секреты.
 *
 * Запуск:  node bridge.mjs            (порт 8878)
 *          node bridge.mjs --port 9000
 *
 * CRM отеля:
 *   GET  /crm/state               — снимок {crm.baseUrl}/api/state
 *   GET  /crm/task/:id            — одна заявка
 *   POST /crm/tasks               — создать заявку (нужен crm.userId)
 *   POST /crm/tasks/:id/status    — сменить статус
 *
 * TeamJet (api.teamjet, вход через Keycloak):
 *   GET  /teamjet/health          — кто я и доступность API
 *   GET  /teamjet/tasks           — список заявок: ?status=1,6&limit=50&offset=0&urgent=1
 *   GET  /teamjet/summary         — счётчики по статусам и срочным
 *   GET  /teamjet/users           — справочник сотрудников (id → имя)
 *
 * Настройки: bridge.config.json рядом со скриптом (создаётся при первом запуске,
 * в git не попадает — там логин/пароль TeamJet).
 *
 * Зависимостей нет. Слушает только 127.0.0.1.
 */
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const configPath = join(here, 'bridge.config.json')

const DEFAULTS = {
  crm: { baseUrl: 'https://mznh5.energycontract.ru', userId: '' },
  teamjet: {
    baseUrl: 'https://mnzh5.teamjet.com',
    hotelKey: 'mnzh5',
    login: '',
    password: '',
  },
}

function loadConfig() {
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULTS, null, 2), 'utf8')
    return structuredClone(DEFAULTS)
  }
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8'))
    return {
      crm: { ...DEFAULTS.crm, ...(raw.crm || {}) },
      teamjet: { ...DEFAULTS.teamjet, ...(raw.teamjet || {}) },
    }
  } catch (error) {
    console.error('bridge.config.json не читается:', error.message)
    return structuredClone(DEFAULTS)
  }
}

const config = loadConfig()

const argPort = process.argv.indexOf('--port')
const PORT = argPort > 0 ? Number(process.argv[argPort + 1]) : Number(process.env.DSH_BRIDGE_PORT || 8878)

export const TEAMJET_STATUSES = {
  1: 'new',
  2: 'inprogress',
  3: 'done',
  4: 'postponed',
  5: 'canceled',
  6: 'accepted',
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

function json(res, status, body) {
  cors(res)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return {} }
}

async function upstream(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(25000) })
  const text = await response.text()
  let body
  try { body = JSON.parse(text) } catch { body = text.slice(0, 500) }
  return { status: response.status, body }
}

// ---------- CRM отеля ----------

async function crmState() {
  return upstream(`${config.crm.baseUrl}/api/state`)
}

// ---------- TeamJet ----------

/** Токен живёт в памяти: при первом запросе делаем логин, дальше переиспользуем. */
const teamjetSession = { token: '', refresh: '', expiresAt: 0, user: null }

function teamjetConfigured() {
  return Boolean(config.teamjet.baseUrl && config.teamjet.login && config.teamjet.password && config.teamjet.hotelKey)
}

async function teamjetLogin() {
  const result = await upstream(`${config.teamjet.baseUrl}/api/keycloak/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: config.teamjet.baseUrl, Referer: `${config.teamjet.baseUrl}/login` },
    body: JSON.stringify({
      login: config.teamjet.login,
      password: config.teamjet.password,
      hotelkey: config.teamjet.hotelKey,
    }),
  })
  if (result.status !== 200 || !result.body || !result.body.access_token) {
    throw new Error(`TeamJet login failed: HTTP ${result.status}`)
  }
  teamjetSession.token = result.body.access_token
  teamjetSession.refresh = result.body.refresh_token || ''
  teamjetSession.expiresAt = Date.now() + Math.max(60, (result.body.expires_in || 300) - 60) * 1000
  return teamjetSession.token
}

async function teamjetRefresh() {
  if (!teamjetSession.refresh) return false
  const result = await upstream(`${config.teamjet.baseUrl}/api/keycloak/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: teamjetSession.refresh }),
  })
  if (result.status !== 200 || !result.body || !result.body.access_token) return false
  teamjetSession.token = result.body.access_token
  if (result.body.refresh_token) teamjetSession.refresh = result.body.refresh_token
  teamjetSession.expiresAt = Date.now() + Math.max(60, (result.body.expires_in || 300) - 60) * 1000
  return true
}

async function teamjetToken() {
  if (!teamjetConfigured()) throw new Error('TeamJet не настроен: задайте teamjet.login и teamjet.password в bridge.config.json')
  if (teamjetSession.token && Date.now() < teamjetSession.expiresAt) return teamjetSession.token
  if (teamjetSession.refresh && await teamjetRefresh()) return teamjetSession.token
  return teamjetLogin()
}

async function teamjetApi(method, path, body) {
  const token = await teamjetToken()
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: config.teamjet.baseUrl,
      Referer: `${config.teamjet.baseUrl}/`,
    },
  }
  if (method !== 'GET') {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body ?? {})
  }
  const result = await upstream(`${config.teamjet.baseUrl}${path}`, options)
  if (result.status === 401 && !body?.__retried) {
    teamjetSession.token = ''
    teamjetSession.expiresAt = 0
    return teamjetApi(method, path, body)
  }
  return result
}

/** Справочник сотрудников: id → имя. Кешируем на 5 минут. */
const usersCache = { at: 0, map: null }
async function teamjetUsers() {
  if (usersCache.map && Date.now() - usersCache.at < 300000) return usersCache.map
  const result = await teamjetApi('GET', '/api/users/list')
  if (result.status !== 200 || !result.body || !Array.isArray(result.body.users)) return {}
  const map = {}
  for (const user of result.body.users) {
    map[user.id] = {
      name: user.name || user.login || user.id,
      login: user.login || '',
      position: user.position ? user.position.name : '',
    }
  }
  usersCache.at = Date.now()
  usersCache.map = map
  return map
}

async function teamjetTasks(query) {
  const statuses = (query.get('status') || '1,2,4,6')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 6)
  const limit = Math.min(50, Math.max(1, Number(query.get('limit') || 50)))
  const offset = Math.max(0, Number(query.get('offset') || 0))

  const result = await teamjetApi('POST', '/api/tasks/v2/list', {
    from: null,
    to: null,
    status: statuses.length ? statuses : [1, 2, 4, 6],
    limit,
    offset,
  })
  if (result.status !== 200 || !result.body) return { status: result.status, body: result.body }

  const users = await teamjetUsers().catch(() => ({}))
  const tasks = (result.body.tasks || []).map((task) => ({
    id: task.id,
    key: task.key,
    room: task.room || '',
    text: task.text || '',
    description: task.description || '',
    status: task.status,
    statusName: TEAMJET_STATUSES[task.status] || String(task.status),
    urgent: Boolean(task.urgent),
    type: task.taskType || '',
    createdAt: task.createdAt ? task.createdAt * 1000 : null,
    deadlineAt: task.deadlineAt ? task.deadlineAt * 1000 : null,
    updatedAt: task.updatedAt ? task.updatedAt * 1000 : null,
    assigneeId: task.assigneeId || '',
    assignee: task.assigneeId && users[task.assigneeId] ? users[task.assigneeId].name : '',
    assigneePosition: task.assigneeId && users[task.assigneeId] ? users[task.assigneeId].position : '',
    commentsCount: task.commentsCount || 0,
    photos: Array.isArray(task.photoTokens) ? task.photoTokens.length : 0,
  }))

  return { status: 200, body: { tasks, count: result.body.count || tasks.length, usersKnown: Object.keys(users).length } }
}

/** Счётчики по статусам: 6 коротких запросов с limit=1, результат кешируется на минуту. */
const summaryCache = { at: 0, body: null }
async function teamjetSummary() {
  if (summaryCache.body && Date.now() - summaryCache.at < 60000) return summaryCache.body
  const counts = {}
  let urgent = 0
  for (const status of [1, 2, 4, 6, 3]) {
    const result = await teamjetApi('POST', '/api/tasks/v2/list', { from: null, to: null, status: [status], limit: 1, offset: 0 })
    counts[status] = result.status === 200 && result.body ? (result.body.count || 0) : null
  }
  const urgentList = await teamjetApi('POST', '/api/tasks/v2/list', { from: null, to: null, status: [1, 2, 4, 6], limit: 50, offset: 0 })
  if (urgentList.status === 200 && urgentList.body && Array.isArray(urgentList.body.tasks)) {
    urgent = urgentList.body.tasks.filter((task) => task.urgent).length
  }
  const body = {
    new: counts[1],
    inprogress: counts[2],
    postponed: counts[4],
    accepted: counts[6],
    done: counts[3],
    urgentOnPage: urgent,
    at: new Date().toISOString(),
  }
  summaryCache.at = Date.now()
  summaryCache.body = body
  return body
}

// ---------- HTTP ----------

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204).end(); return }

  try {
    if (path === '/health') {
      return json(res, 200, {
        ok: true,
        crm: config.crm.baseUrl,
        teamjet: config.teamjet.baseUrl,
        teamjetConfigured: teamjetConfigured(),
        teamjetToken: teamjetSession.token ? 'активен' : 'нет',
      })
    }

    // CRM отеля
    if (path === '/crm/state') {
      const result = await crmState()
      return json(res, result.status, result.body)
    }
    if (path.startsWith('/crm/task/')) {
      const id = decodeURIComponent(path.slice('/crm/task/'.length))
      const result = await upstream(`${config.crm.baseUrl}/api/tasks/${encodeURIComponent(id)}`)
      return json(res, result.status, result.body)
    }
    if (path === '/crm/tasks' && req.method === 'POST') {
      const body = await readBody(req)
      if (!config.crm.userId) return json(res, 400, { error: 'в bridge.config.json не задан crm.userId' })
      const result = await upstream(`${config.crm.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId: config.crm.userId }),
      })
      return json(res, result.status, result.body)
    }
    const crmStatus = path.match(/^\/crm\/tasks\/([^/]+)\/status$/)
    if (crmStatus && req.method === 'POST') {
      const body = await readBody(req)
      if (!config.crm.userId) return json(res, 400, { error: 'в bridge.config.json не задан crm.userId' })
      const result = await upstream(`${config.crm.baseUrl}/api/tasks/${encodeURIComponent(crmStatus[1])}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId: config.crm.userId }),
      })
      return json(res, result.status, result.body)
    }

    // TeamJet
    if (path === '/teamjet/health') {
      if (!teamjetConfigured()) return json(res, 409, { error: 'TeamJet не настроен', configured: false })
      const me = await teamjetApi('GET', '/api/users/self')
      return json(res, 200, {
        configured: true,
        me: me.status === 200 && me.body ? { id: me.body.id, name: me.body.name, login: me.body.login, position: me.body.position && me.body.position.name } : null,
        tokenActive: Boolean(teamjetSession.token),
      })
    }
    if (path === '/teamjet/tasks') {
      const result = await teamjetTasks(url.searchParams)
      return json(res, result.status, result.body)
    }
    if (path === '/teamjet/summary') {
      return json(res, 200, await teamjetSummary())
    }
    if (path === '/teamjet/users') {
      return json(res, 200, await teamjetUsers())
    }

    return json(res, 404, { error: `неизвестный маршрут: ${path}` })
  } catch (error) {
    return json(res, 502, { error: String(error && error.message ? error.message : error) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`мост слушает http://127.0.0.1:${PORT}`)
  console.log(`  CRM:     ${config.crm.baseUrl}`)
  console.log(`  TeamJet: ${config.teamjet.baseUrl} (${teamjetConfigured() ? 'логин задан' : 'логин не задан'})`)
  console.log(`  конфиг:  ${configPath}`)
})
