window.__ModuleLoader__.load({
  id: '@dsh-local/view-hotel-crm',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const PANEL_ID = '@dsh-local/view-hotel-crm:panel'
    const NS = 'hotel-crm'
    const BRIDGE = 'http://127.0.0.1:8878'
    const REFRESH_MS = 30000
    const ACTIVE_STATUSES = ['new', 'assigned', 'in_progress', 'on_hold']

    // #region dictionaries
    const ru = {
      panel: 'Заявки отеля',
      title: 'Заявки отеля',
      subtitle: 'Живой список заявок из CRM «Манжерок 5★»',
      total: 'Активных',
      fresh: 'Новые',
      working: 'В работе',
      breached: 'Просрочено',
      search: 'Номер, заявка, гость…',
      refresh: 'Обновить',
      auto: 'Автообновление',
      loading: 'Загружаю заявки…',
      empty: 'Под фильтр не попала ни одна заявка',
      updated: 'обновлено',
      open: 'Открыть CRM',
      source: 'источник',
      colId: '№',
      colRoom: 'Номер',
      colTask: 'Заявка',
      colPriority: 'Приоритет',
      colStatus: 'Статус',
      colSla: 'SLA',
      colWho: 'Исполнитель',
      all: 'Все',
      active: 'Активные',
      onlyBreached: 'Просроченные',
      done: 'Закрытые',
      bridgeDown: 'Мост не отвечает',
      bridgeHint: 'Запустите его на этом компьютере: в папке dsh-config выполните node bridge\\bridge.mjs',
      bridgeHint2: 'Мост слушает 127.0.0.1:8878 и проксирует CRM, чтобы страница не упиралась в CORS.',
      retry: 'Повторить',
      noOne: 'не назначен',
      late: 'просрочено на',
      left: 'осталось',
      unitH: 'ч',
      unitM: 'м',
      unitD: 'д',
      statusNew: 'новая',
      statusAssigned: 'назначена',
      statusIn_progress: 'в работе',
      statusOn_hold: 'приостановлена',
      statusDone: 'закрыта',
      statusCancelled: 'отменена',
      priorityLow: 'низкий',
      priorityNormal: 'обычный',
      priorityHigh: 'высокий',
      priorityUrgent: 'срочный',
    }
    const en = {
      panel: 'Hotel requests',
      title: 'Hotel requests',
      subtitle: 'Live request list from the «Манжерок 5★» CRM',
      total: 'Active',
      fresh: 'New',
      working: 'In progress',
      breached: 'Overdue',
      search: 'Number, request, guest…',
      refresh: 'Refresh',
      auto: 'Auto refresh',
      loading: 'Loading requests…',
      empty: 'No request matches this filter',
      updated: 'updated',
      open: 'Open CRM',
      source: 'source',
      colId: 'ID',
      colRoom: 'Room',
      colTask: 'Request',
      colPriority: 'Priority',
      colStatus: 'Status',
      colSla: 'SLA',
      colWho: 'Assignee',
      all: 'All',
      active: 'Active',
      onlyBreached: 'Overdue',
      done: 'Closed',
      bridgeDown: 'Bridge is not responding',
      bridgeHint: 'Start it on this computer: in the dsh-config folder run node bridge\\bridge.mjs',
      bridgeHint2: 'The bridge listens on 127.0.0.1:8878 and proxies the CRM so the page is not blocked by CORS.',
      retry: 'Retry',
      noOne: 'unassigned',
      late: 'overdue by',
      left: 'left',
      unitH: 'h',
      unitM: 'm',
      unitD: 'd',
      statusNew: 'new',
      statusAssigned: 'assigned',
      statusIn_progress: 'in progress',
      statusOn_hold: 'on hold',
      statusDone: 'done',
      statusCancelled: 'cancelled',
      priorityLow: 'low',
      priorityNormal: 'normal',
      priorityHigh: 'high',
      priorityUrgent: 'urgent',
    }
    const zh = {
      panel: '酒店工单',
      title: '酒店工单',
      subtitle: '来自 «Манжерок 5★» CRM 的实时工单列表',
      total: '进行中',
      fresh: '新建',
      working: '处理中',
      breached: '已超时',
      search: '编号、工单、客人…',
      refresh: '刷新',
      auto: '自动刷新',
      loading: '正在加载工单…',
      empty: '没有符合筛选条件的工单',
      updated: '更新于',
      open: '打开 CRM',
      source: '来源',
      colId: '编号',
      colRoom: '房间',
      colTask: '工单',
      colPriority: '优先级',
      colStatus: '状态',
      colSla: 'SLA',
      colWho: '负责人',
      all: '全部',
      active: '进行中',
      onlyBreached: '已超时',
      done: '已关闭',
      bridgeDown: '桥接服务未响应',
      bridgeHint: '在本机启动：在 dsh-config 目录运行 node bridge\\bridge.mjs',
      bridgeHint2: '桥接服务监听 127.0.0.1:8878 并代理 CRM，避开浏览器 CORS 限制。',
      retry: '重试',
      noOne: '未指派',
      late: '已超时',
      left: '剩余',
      unitH: '小时',
      unitM: '分',
      unitD: '天',
      statusNew: '新建',
      statusAssigned: '已指派',
      statusIn_progress: '处理中',
      statusOn_hold: '暂停',
      statusDone: '已完成',
      statusCancelled: '已取消',
      priorityLow: '低',
      priorityNormal: '普通',
      priorityHigh: '高',
      priorityUrgent: '紧急',
    }
    // #endregion dictionaries

    // #region helpers
    const PRIORITY_WEIGHT = { urgent: 0, high: 1, normal: 2, low: 3 }

    function humanMs(ms, t) {
      const abs = Math.abs(ms)
      const minutes = Math.round(abs / 60000)
      if (minutes < 60) return minutes + ' ' + t('unitM')
      const hours = Math.round(minutes / 60)
      if (hours < 48) return hours + ' ' + t('unitH')
      return Math.round(hours / 24) + ' ' + t('unitD')
    }

    function byId(list) {
      const map = new Map()
      for (const item of list || []) if (item && item.id) map.set(item.id, item)
      return map
    }

    function nameOf(record, fallback) {
      if (!record) return fallback
      return record.name || record.title || record.fullName || record.login || fallback
    }
    // #endregion helpers

    // #region view
    const CSS = `
.hcrm-page {
  height: 100%;
  overflow: auto;
  padding: 20px 24px 32px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}
.hcrm-head { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
.hcrm-head h1 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.hcrm-head p { margin: 3px 0 0; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.hcrm-head-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.hcrm-kpis { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; margin-bottom: 14px; }
.hcrm-kpi {
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
}
.hcrm-kpi-label { font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.hcrm-kpi-value { font-size: 20px; font-weight: 600; margin-top: 2px; }
.hcrm-kpi.danger .hcrm-kpi-value { color: var(--dsw-alias-state-error-primary); }
.hcrm-kpi.warn .hcrm-kpi-value { color: var(--dsw-alias-state-warn-primary); }
.hcrm-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
.hcrm-input {
  flex: 1 1 220px;
  min-width: 160px;
  padding: 6px 10px;
  font: inherit;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
}
.hcrm-chip {
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  cursor: pointer;
}
.hcrm-chip.active {
  color: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-bg-layer-2);
}
.hcrm-button {
  padding: 6px 12px;
  font: inherit;
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  cursor: pointer;
}
.hcrm-button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.hcrm-table { width: 100%; border-collapse: collapse; }
.hcrm-table th {
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: var(--dsw-alias-label-tertiary);
  padding: 6px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.hcrm-table td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  vertical-align: top;
}
.hcrm-row:hover td { background: var(--dsw-alias-interactive-bg-hover); }
.hcrm-id { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.hcrm-title { font-weight: 500; }
.hcrm-note { display: block; font-size: 11px; color: var(--dsw-alias-label-tertiary); margin-top: 2px; }
.hcrm-badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 11px; white-space: nowrap; }
.hcrm-badge.urgent { color: var(--dsw-alias-state-error-primary); background: var(--dsw-alias-state-error-tertiary, rgba(220,53,69,.12)); }
.hcrm-badge.high { color: var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-state-warn-tertiary, rgba(255,193,7,.14)); }
.hcrm-badge.normal, .hcrm-badge.low { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }
.hcrm-badge.done { color: var(--dsw-alias-state-success-primary); background: var(--dsw-alias-state-success-tertiary, rgba(40,167,69,.12)); }
.hcrm-badge.cancelled { color: var(--dsw-alias-state-idle-primary); background: var(--dsw-alias-bg-layer-2); }
.hcrm-badge.new { color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.hcrm-badge.assigned, .hcrm-badge.in_progress { color: var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-bg-layer-2); }
.hcrm-badge.on_hold { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }
.hcrm-sla { font-variant-numeric: tabular-nums; white-space: nowrap; }
.hcrm-sla.late { color: var(--dsw-alias-state-error-primary); font-weight: 500; }
.hcrm-sla.soon { color: var(--dsw-alias-state-warn-primary); }
.hcrm-muted { color: var(--dsw-alias-label-tertiary); }
.hcrm-error {
  margin: 24px 0;
  padding: 16px 18px;
  border: 1px solid var(--dsw-alias-state-error-primary);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.hcrm-error h2 { margin: 0 0 6px; font-size: 14px; color: var(--dsw-alias-state-error-primary); }
.hcrm-error p { margin: 6px 0; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.hcrm-error code {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--dsw-alias-markdown-inline-code, rgba(127,127,127,.16));
  font-size: 11.5px;
}
.hcrm-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}
.hcrm-foot a { color: var(--dsw-alias-brand-primary); text-decoration: none; }
.hcrm-foot a:hover { text-decoration: underline; }
`
    // #endregion view

    function HotelIcon({ size }) {
      const edge = Number.isFinite(size) ? size : 16
      return h(
        'svg',
        {
          width: edge,
          height: edge,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.35,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M2 13.5V6.2a1 1 0 0 1 .45-.83l5.05-3.4a1 1 0 0 1 1.1 0l5.05 3.4a1 1 0 0 1 .45.83v7.3' }),
        h('path', { d: 'M6.2 13.5V9.6h3.6v3.9' }),
      )
    }

    function Tile({ label, value, tone }) {
      return h(
        'div',
        { class: 'hcrm-kpi' + (tone ? ' ' + tone : '') },
        h('div', { class: 'hcrm-kpi-label' }, label),
        h('div', { class: 'hcrm-kpi-value' }, String(value)),
      )
    }

    function ErrorBox({ t, error, onRetry }) {
      return h(
        'div',
        { class: 'hcrm-error' },
        h('h2', null, t('bridgeDown') + (error ? ' — ' + error : '')),
        h('p', null, t('bridgeHint')),
        h('p', null, h('code', null, 'node bridge\\bridge.mjs')),
        h('p', null, t('bridgeHint2')),
        h('p', null, h('button', { class: 'hcrm-button', onClick: onRetry }, t('retry'))),
      )
    }

    function HotelCrmPage({ t }) {
      const translate = typeof t === 'function' ? t : (key) => (ru[key] === undefined ? key : ru[key])
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState('')
      const [loading, setLoading] = React.useState(true)
      const [query, setQuery] = React.useState('')
      const [filter, setFilter] = React.useState('active')
      const [auto, setAuto] = React.useState(true)
      const [tick, setTick] = React.useState(0)

      const load = React.useCallback(() => {
        let alive = true
        setLoading(true)
        fetch(BRIDGE + '/crm/state', { cache: 'no-store' })
          .then((response) => {
            if (!response.ok) throw new Error('HTTP ' + response.status)
            return response.json()
          })
          .then((payload) => {
            if (!alive) return
            setData(payload)
            setError('')
          })
          .catch((cause) => {
            if (!alive) return
            setError(cause && cause.message ? cause.message : String(cause))
          })
          .finally(() => {
            if (alive) setLoading(false)
          })
        return () => { alive = false }
      }, [])

      React.useEffect(() => load(), [load, tick])
      React.useEffect(() => {
        if (!auto) return undefined
        const timer = setInterval(() => setTick((value) => value + 1), REFRESH_MS)
        return () => clearInterval(timer)
      }, [auto])

      const view = React.useMemo(() => {
        const tasks = (data && data.tasks) || []
        const hotelMap = byId(data && data.hotels)
        const userMap = byId(data && data.users)
        const needle = query.trim().toLowerCase()

        const decorated = tasks.map((task) => ({
          task,
          id: task.id,
          room: task.room || '',
          title: task.title || '',
          guest: task.guest || '',
          priority: task.priority || 'normal',
          status: task.status || 'new',
          sla: task.sla || {},
          hotel: nameOf(hotelMap.get(task.hotelId), task.hotelId || ''),
          who: task.assigneeId ? nameOf(userMap.get(task.assigneeId), task.assigneeId) : '',
          active: ACTIVE_STATUSES.includes(task.status),
        }))

        const activeList = decorated.filter((row) => row.active)
        const breachedList = activeList.filter((row) => row.sla && row.sla.breached)
        const kpi = {
          active: activeList.length,
          fresh: decorated.filter((row) => row.status === 'new').length,
          working: decorated.filter((row) => row.status === 'in_progress').length,
          breached: breachedList.length,
        }

        let rows = decorated
        if (filter === 'active') rows = activeList
        else if (filter === 'breached') rows = breachedList
        else if (filter === 'done') rows = decorated.filter((row) => row.status === 'done' || row.status === 'cancelled')
        else if (filter !== 'all') rows = decorated.filter((row) => row.status === filter)

        if (needle) {
          rows = rows.filter((row) =>
            [row.id, row.room, row.title, row.guest, row.hotel, row.who].join(' ').toLowerCase().includes(needle),
          )
        }

        rows = rows.slice().sort((a, b) => {
          const aLate = a.active && a.sla && a.sla.breached ? 0 : 1
          const bLate = b.active && b.sla && b.sla.breached ? 0 : 1
          if (aLate !== bLate) return aLate - bLate
          const aw = PRIORITY_WEIGHT[a.priority] ?? 9
          const bw = PRIORITY_WEIGHT[b.priority] ?? 9
          if (aw !== bw) return aw - bw
          return String(b.task.createdAt || '').localeCompare(String(a.task.createdAt || ''))
        })

        return { kpi, rows, total: decorated.length, serverTime: data && data.serverTime }
      }, [data, query, filter])

      const chips = [
        ['active', translate('active')],
        ['all', translate('all')],
        ['new', translate('statusNew')],
        ['in_progress', translate('statusIn_progress')],
        ['breached', translate('onlyBreached')],
        ['done', translate('done')],
      ]

      const updatedText = (() => {
        const raw = view.serverTime || (data && data.serverTime)
        if (!raw) return ''
        const date = new Date(raw)
        if (Number.isNaN(date.getTime())) return ''
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      })()

      return h(
        'div',
        { class: 'hcrm-page' },
        h('style', null, CSS),
        h(
          'div',
          { class: 'hcrm-head' },
          h('div', null, h('h1', null, translate('title')), h('p', null, translate('subtitle'))),
          h(
            'div',
            { class: 'hcrm-head-actions' },
            h('label', { class: 'hcrm-chip' + (auto ? ' active' : '') },
              h('input', {
                type: 'checkbox',
                checked: auto,
                onChange: (event) => setAuto(event.target.checked),
                style: { marginRight: '6px', verticalAlign: 'middle' },
              }),
              translate('auto')),
            h('button', { class: 'hcrm-button', onClick: () => setTick((value) => value + 1), disabled: loading }, translate('refresh')),
          ),
        ),

        error
          ? h(ErrorBox, { t: translate, error, onRetry: () => setTick((value) => value + 1) })
          : null,

        data
          ? h(
            'div',
            null,
            h(
              'div',
              { class: 'hcrm-kpis' },
              h(Tile, { label: translate('total'), value: view.kpi.active }),
              h(Tile, { label: translate('fresh'), value: view.kpi.fresh }),
              h(Tile, { label: translate('working'), value: view.kpi.working, tone: 'warn' }),
              h(Tile, { label: translate('breached'), value: view.kpi.breached, tone: 'danger' }),
            ),
            h(
              'div',
              { class: 'hcrm-bar' },
              h('input', {
                class: 'hcrm-input',
                placeholder: translate('search'),
                value: query,
                onChange: (event) => setQuery(event.target.value),
              }),
              chips.map(([id, label]) =>
                h('button', {
                  key: id,
                  class: 'hcrm-chip' + (filter === id ? ' active' : ''),
                  onClick: () => setFilter(id),
                }, label)),
            ),
            view.rows.length
              ? h(
                'table',
                { class: 'hcrm-table' },
                h('thead', null, h('tr', null,
                  h('th', null, translate('colId')),
                  h('th', null, translate('colRoom')),
                  h('th', null, translate('colTask')),
                  h('th', null, translate('colPriority')),
                  h('th', null, translate('colStatus')),
                  h('th', null, translate('colSla')),
                  h('th', null, translate('colWho')),
                )),
                h('tbody', null, view.rows.map((row) => {
                  const sla = row.sla || {}
                  const breached = Boolean(sla.breached)
                  const remaining = Number(sla.remainingMs)
                  let slaText = '—'
                  let slaClass = ''
                  if (row.active && Number.isFinite(remaining)) {
                    slaText = (breached ? translate('late') + ' ' : translate('left') + ' ') + humanMs(remaining, translate)
                    if (breached) slaClass = ' late'
                    else if (remaining < 3600000) slaClass = ' soon'
                  } else if (!row.active) {
                    slaText = '—'
                  }
                  return h('tr', { key: row.id, class: 'hcrm-row' },
                    h('td', { class: 'hcrm-id' }, row.id),
                    h('td', null, row.room || h('span', { class: 'hcrm-muted' }, '—')),
                    h('td', null,
                      h('span', { class: 'hcrm-title' }, row.title),
                      h('span', { class: 'hcrm-note' },
                        [row.hotel, row.guest ? row.guest : ''].filter(Boolean).join(' · ')),
                    ),
                    h('td', null, h('span', { class: 'hcrm-badge ' + row.priority }, translate('priority' + row.priority.charAt(0).toUpperCase() + row.priority.slice(1)))),
                    h('td', null, h('span', { class: 'hcrm-badge ' + row.status }, translate('status' + row.status.charAt(0).toUpperCase() + row.status.slice(1)))),
                    h('td', { class: 'hcrm-sla' + slaClass }, slaText),
                    h('td', null, row.who || h('span', { class: 'hcrm-muted' }, translate('noOne'))),
                  )
                })),
              )
              : h('p', { class: 'hcrm-muted' }, loading ? translate('loading') : translate('empty')),
          )
          : h('p', { class: 'hcrm-muted' }, error ? '' : translate('loading')),

        h(
          'div',
          { class: 'hcrm-foot' },
          h('span', null, translate('source') + ': ' + BRIDGE + '/crm/state'),
          updatedText ? h('span', null, '· ' + translate('updated') + ' ' + updatedText) : null,
          h('a', { href: 'https://mznh5.energycontract.ru/', target: '_blank', rel: 'noreferrer' }, translate('open') + ' ↗'),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en, ru }), 'hotel-crm: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 34,
          label: () => t('panel'),
          locale: NS,
        }, HotelIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t }),
        }, HotelCrmPage))
      },
    }
  },
})
