/**
 * Локальный мост для плагинов DSH: CRM отеля и TeamJet.
 *
 * Зачем: страницы плагинов живут в браузере DSH (http://127.0.0.1:17198),
 * поэтому читать чужие API напрямую им мешает CORS, а токен TeamJet нельзя
 * держать в браузерном коде. Мост — единственное место, где есть сеть и секреты.
 *
 * Запуск:  node bridge.mjs            (порт 8878)
 *          node bridge.mjs --port 9000
 *
 * Маршруты:
 *   GET /health                  — самопроверка
 *   GET /crm/state               — прокси на {crm.baseUrl}/api/state
 *   GET /crm/task/:id            — одна заявка
 *   POST /crm/tasks              — создать заявку (нужен userId хозяина моста)
 *   POST /crm/tasks/:id/status   — сменить статус
 *   GET /teamjet/probe           — проверка доступа к TeamJet (нужен токен)
 *   GET /teamjet/tasks           — список заявок TeamJet (нужен токен)
 *
 * Настройки: bridge.config.json рядом со скриптом (создаётся при первом запуске)
 *   { "crm": { "baseUrl": "https://mznh5.energycontract.ru" },
 *     "teamjet": { "baseUrl": "https://mnzh5.teamjet.com", "token": "", "tasksPath": "" },
 *     "userId": "" }
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
  crm: { baseUrl: 'https://mznh5.energycontract.ru' },
  teamjet: { baseUrl: 'https://mnzh5.teamjet.com', token: '', tasksPath: '' },
  userId: '',
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
      userId: raw.userId || '',
    }
  } catch (error) {
    console.error('bridge.config.json не читается:', error.message)
    return structuredClone(DEFAULTS)
  }
}

let config = loadConfig()

const argPort = process.argv.indexOf('--port')
const PORT = argPort > 0 ? Number(process.argv[argPort + 1]) : Number(process.env.DSH_BRIDGE_PORT || 8878)

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
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) })
  const text = await response.text()
  let body
  try { body = JSON.parse(text) } catch { body = text.slice(0, 500) }
  return { status: response.status, body }
}

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
        teamjetToken: config.teamjet.token ? 'задан' : 'нет',
        userId: config.userId || null,
        serverTime: new Date().toISOString(),
      })
    }

    // --- CRM отеля ---
    if (path === '/crm/state') {
      const result = await upstream(`${config.crm.baseUrl}/api/state`)
      return json(res, result.status, result.body)
    }
    if (path.startsWith('/crm/task/')) {
      const id = decodeURIComponent(path.slice('/crm/task/'.length))
      const result = await upstream(`${config.crm.baseUrl}/api/tasks/${encodeURIComponent(id)}`)
      return json(res, result.status, result.body)
    }
    if (path === '/crm/tasks' && req.method === 'POST') {
      const body = await readBody(req)
      if (!config.userId) return json(res, 400, { error: 'в bridge.config.json не задан userId — от имени кого создавать заявку' })
      const result = await upstream(`${config.crm.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId: config.userId }),
      })
      return json(res, result.status, result.body)
    }
    const statusMatch = path.match(/^\/crm\/tasks\/([^/]+)\/status$/)
    if (statusMatch && req.method === 'POST') {
      const body = await readBody(req)
      if (!config.userId) return json(res, 400, { error: 'в bridge.config.json не задан userId' })
      const result = await upstream(`${config.crm.baseUrl}/api/tasks/${encodeURIComponent(statusMatch[1])}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId: config.userId }),
      })
      return json(res, result.status, result.body)
    }

    // --- TeamJet ---
    if (path === '/teamjet/probe') {
      const base = config.teamjet.baseUrl
      const hasToken = Boolean(config.teamjet.token)
      const target = config.teamjet.tasksPath || '/'
      const headers = hasToken ? { Authorization: `Bearer ${config.teamjet.token}` } : {}
      let reachable = null
      try {
        const result = await upstream(`${base}${target}`, { headers, redirect: 'manual' })
        reachable = { status: result.status, bodyPreview: typeof result.body === 'string' ? result.body.slice(0, 200) : '[json]' }
      } catch (error) {
        reachable = { error: error.message }
      }
      return json(res, 200, {
        configured: hasToken && Boolean(config.teamjet.tasksPath),
        baseUrl: base,
        tokenSet: hasToken,
        tasksPath: config.teamjet.tasksPath || null,
        probe: reachable,
        hint: hasToken && config.teamjet.tasksPath
          ? 'проверьте, что ответ похож на список заявок'
          : 'нужны token и tasksPath из настроек API TeamJet — публичной документации у TeamJet нет',
      })
    }
    if (path === '/teamjet/tasks') {
      if (!config.teamjet.token || !config.teamjet.tasksPath) {
        return json(res, 409, { error: 'TeamJet не настроен: задайте teamjet.token и teamjet.tasksPath в bridge.config.json' })
      }
      const result = await upstream(`${config.teamjet.baseUrl}${config.teamjet.tasksPath}`, {
        headers: { Authorization: `Bearer ${config.teamjet.token}`, Accept: 'application/json' },
      })
      return json(res, result.status, result.body)
    }

    return json(res, 404, { error: `неизвестный маршрут: ${path}` })
  } catch (error) {
    return json(res, 502, { error: String(error && error.message ? error.message : error) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`мост слушает http://127.0.0.1:${PORT}`)
  console.log(`  CRM:     ${config.crm.baseUrl}`)
  console.log(`  TeamJet: ${config.teamjet.baseUrl} (токен ${config.teamjet.token ? 'задан' : 'не задан'})`)
  console.log(`  конфиг:  ${configPath}`)
})
