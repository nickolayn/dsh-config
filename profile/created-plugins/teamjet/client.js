window.__ModuleLoader__.load({
  id: '@dsh-local/view-teamjet',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const PANEL_ID = '@dsh-local/view-teamjet:panel'
    const NS = 'teamjet'
    const BRIDGE = 'http://127.0.0.1:8878'
    const REFRESH_MS = 45000
    const OPEN_URL = 'https://mnzh5.teamjet.com/tasks/general'

    // #region dictionaries
    const ru = {
      panel: 'TeamJet',
      title: 'Заявки TeamJet',
      subtitle: 'Живой список заявок отеля из TeamJet',
      new: 'Новые',
      inprogress: 'В работе',
      accepted: 'Приняты',
      postponed: 'Отложены',
      urgent: 'Срочные',
      all: 'Все',
      active: 'Активные',
      search: 'Ключ, помещение, текст, исполнитель…',
      refresh: 'Обновить',
      auto: 'Автообновление',
      loading: 'Загружаю заявки…',
      empty: 'Под фильтр не попала ни одна заявка',
      updated: 'обновлено',
      open: 'Открыть TeamJet',
      source: 'источник',
      colKey: '№',
      colRoom: 'Помещение',
      colTask: 'Заявка',
      colStatus: 'Статус',
      colWho: 'Исполнитель',
      colDue: 'Срок',
      bridgeDown: 'Мост не отвечает',
      bridgeHint: 'Запустите его: в папке dsh-config выполните node bridge\\bridge.mjs',
      bridgeHint2: 'Мост входит в TeamJet через Keycloak и отдаёт заявки странице без CORS.',
      retry: 'Повторить',
      noOne: 'не назначен',
      noDue: 'без срока',
      late: 'просрочен на',
      left: 'осталось',
      unitH: 'ч',
      unitM: 'м',
      unitD: 'д',
      statusNew: 'новая',
      statusInprogress: 'в работе',
      statusAccepted: 'принята',
      statusPostponed: 'отложена',
      statusDone: 'выполнена',
      statusCanceled: 'отменена',
      photos: 'фото',
      comments: 'комм.',
    }
    const en = {
      panel: 'TeamJet',
      title: 'TeamJet requests',
      subtitle: 'Live hotel request list from TeamJet',
      new: 'New',
      inprogress: 'In progress',
      accepted: 'Accepted',
      postponed: 'Postponed',
      urgent: 'Urgent',
      all: 'All',
      active: 'Active',
      search: 'Key, place, text, assignee…',
      refresh: 'Refresh',
      auto: 'Auto refresh',
      loading: 'Loading requests…',
      empty: 'No request matches this filter',
      updated: 'updated',
      open: 'Open TeamJet',
      source: 'source',
      colKey: 'ID',
      colRoom: 'Place',
      colTask: 'Request',
      colStatus: 'Status',
      colWho: 'Assignee',
      colDue: 'Due',
      bridgeDown: 'Bridge is not responding',
      bridgeHint: 'Start it: in the dsh-config folder run node bridge\\bridge.mjs',
      bridgeHint2: 'The bridge signs in to TeamJet through Keycloak and serves requests to the page without CORS.',
      retry: 'Retry',
      noOne: 'unassigned',
      noDue: 'no due date',
      late: 'overdue by',
      left: 'left',
      unitH: 'h',
      unitM: 'm',
      unitD: 'd',
      statusNew: 'new',
      statusInprogress: 'in progress',
      statusAccepted: 'accepted',
      statusPostponed: 'postponed',
      statusDone: 'done',
      statusCanceled: 'cancelled',
      photos: 'photos',
      comments: 'comments',
    }
    const zh = {
      panel: 'TeamJet',
      title: 'TeamJet 工单',
      subtitle: '来自 TeamJet 的酒店实时工单',
      new: '新建',
      inprogress: '处理中',
      accepted: '已接收',
      postponed: '已推迟',
      urgent: '紧急',
      all: '全部',
      active: '活跃',
      search: '编号、位置、内容、负责人…',
      refresh: '刷新',
      auto: '自动刷新',
      loading: '正在加载工单…',
      empty: '没有符合筛选条件的工单',
      updated: '更新于',
      open: '打开 TeamJet',
      source: '来源',
      colKey: '编号',
      colRoom: '位置',
      colTask: '工单',
      colStatus: '状态',
      colWho: '负责人',
      colDue: '期限',
      bridgeDown: '桥接服务未响应',
      bridgeHint: '启动：在 dsh-config 目录运行 node bridge\\bridge.mjs',
      bridgeHint2: '桥接服务通过 Keycloak 登录 TeamJet，并绕过浏览器 CORS 限制。',
      retry: '重试',
      noOne: '未指派',
      noDue: '无期限',
      late: '已超时',
      left: '剩余',
      unitH: '小时',
      unitM: '分',
      unitD: '天',
      statusNew: '新建',
      statusInprogress: '处理中',
      statusAccepted: '已接受',
      statusPostponed: '已推迟',
      statusDone: '已完成',
      statusCanceled: '已取消',
      photos: '照片',
      comments: '评论',
    }
    // #endregion dictionaries

    function humanMs(ms, t) {
      const abs = Math.abs(ms)
      const minutes = Math.round(abs / 60000)
      if (minutes < 60) return minutes + ' ' + t('unitM')
      const hours = Math.round(minutes / 60)
      if (hours < 48) return hours + ' ' + t('unitH')
      return Math.round(hours / 24) + ' ' + t('unitD')
    }

    const CSS = `
.tj-page { height: 100%; overflow: auto; padding: 20px 24px 32px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-size: 13px; }
.tj-head { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
.tj-head h1 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.tj-head p { margin: 3px 0 0; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.tj-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.tj-kpis { display: grid; grid-template-columns: repeat(5, minmax(110px, 1fr)); gap: 10px; margin-bottom: 14px; }
.tj-kpi { padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
.tj-kpi-label { font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.tj-kpi-value { font-size: 20px; font-weight: 600; margin-top: 2px; }
.tj-kpi.urgent .tj-kpi-value { color: var(--dsw-alias-state-error-primary); }
.tj-kpi.accepted .tj-kpi-value { color: var(--dsw-alias-state-success-primary); }
.tj-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
.tj-input { flex: 1 1 240px; min-width: 160px; padding: 6px 10px; font: inherit; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; }
.tj-chip { padding: 5px 10px; font: inherit; font-size: 12px; color: var(--dsw-alias-label-secondary); background: transparent; border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; cursor: pointer; }
.tj-chip.active { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.tj-button { padding: 6px 12px; font: inherit; font-size: 12px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; cursor: pointer; }
.tj-button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.tj-table { width: 100%; border-collapse: collapse; }
.tj-table th { text-align: left; font-size: 11px; font-weight: 500; color: var(--dsw-alias-label-tertiary); padding: 6px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.tj-table td { padding: 7px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: top; }
.tj-row:hover td { background: var(--dsw-alias-interactive-bg-hover); }
.tj-key { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.tj-title { font-weight: 500; }
.tj-note { display: block; font-size: 11px; color: var(--dsw-alias-label-tertiary); margin-top: 2px; }
.tj-badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 11px; white-space: nowrap; }
.tj-badge.new { color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.tj-badge.inprogress { color: var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-bg-layer-2); }
.tj-badge.accepted { color: var(--dsw-alias-state-success-primary); background: var(--dsw-alias-state-success-tertiary, rgba(40,167,69,.12)); }
.tj-badge.postponed { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }
.tj-badge.done { color: var(--dsw-alias-state-success-primary); background: var(--dsw-alias-bg-layer-2); }
.tj-badge.canceled { color: var(--dsw-alias-state-idle-primary); background: var(--dsw-alias-bg-layer-2); }
.tj-urgent { color: var(--dsw-alias-state-error-primary); font-size: 11px; margin-left: 6px; }
.tj-due { font-variant-numeric: tabular-nums; white-space: nowrap; }
.tj-due.late { color: var(--dsw-alias-state-error-primary); font-weight: 500; }
.tj-due.soon { color: var(--dsw-alias-state-warn-primary); }
.tj-muted { color: var(--dsw-alias-label-tertiary); }
.tj-error { margin: 24px 0; padding: 16px 18px; border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.tj-error h2 { margin: 0 0 6px; font-size: 14px; color: var(--dsw-alias-state-error-primary); }
.tj-error p { margin: 6px 0; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.tj-error code { display: inline-block; padding: 2px 6px; border-radius: 5px; background: var(--dsw-alias-markdown-inline-code, rgba(127,127,127,.16)); font-size: 11.5px; }
.tj-foot { display: flex; align-items: center; gap: 10px; margin-top: 12px; font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.tj-foot a { color: var(--dsw-alias-brand-primary); text-decoration: none; }
.tj-foot a:hover { text-decoration: underline; }
`

    function TeamJetIcon({ size }) {
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
        h('path', { d: 'M3 4.5h10M3 8h10M3 11.5h6' }),
        h('circle', { cx: 12.6, cy: 11.4, r: 1.9 }),
        h('path', { d: 'M12.6 10.4v1.4l1 .6' }),
      )
    }

    function Tile({ label, value, tone }) {
      return h(
        'div',
        { class: 'tj-kpi' + (tone ? ' ' + tone : '') },
        h('div', { class: 'tj-kpi-label' }, label),
        h('div', { class: 'tj-kpi-value' }, value === null || value === undefined ? '—' : String(value)),
      )
    }

    function ErrorBox({ t, error, onRetry }) {
      return h(
        'div',
        { class: 'tj-error' },
        h('h2', null, t('bridgeDown') + (error ? ' — ' + error : '')),
        h('p', null, t('bridgeHint')),
        h('p', null, h('code', null, 'node bridge\\bridge.mjs')),
        h('p', null, t('bridgeHint2')),
        h('p', null, h('button', { class: 'tj-button', onClick: onRetry }, t('retry'))),
      )
    }

    function TeamJetPage({ t }) {
      const translate = typeof t === 'function' ? t : (key) => (ru[key] === undefined ? key : ru[key])
      const [data, setData] = React.useState(null)
      const [summary, setSummary] = React.useState(null)
      const [error, setError] = React.useState('')
      const [loading, setLoading] = React.useState(true)
      const [query, setQuery] = React.useState('')
      const [filter, setFilter] = React.useState('active')
      const [auto, setAuto] = React.useState(true)
      const [tick, setTick] = React.useState(0)

      const load = React.useCallback(() => {
        let alive = true
        setLoading(true)
        const statuses = filter === 'active' ? '1,2,4,6' : filter === 'all' ? '1,2,3,4,5,6' : filter
        const tasksUrl = BRIDGE + '/teamjet/tasks?limit=50&offset=0&status=' + statuses
        Promise.all([
          fetch(tasksUrl, { cache: 'no-store' }).then((response) => {
            if (!response.ok) throw new Error('tasks HTTP ' + response.status)
            return response.json()
          }),
          fetch(BRIDGE + '/teamjet/summary', { cache: 'no-store' }).then((response) => (response.ok ? response.json() : null)).catch(() => null),
        ])
          .then(([tasks, counts]) => {
            if (!alive) return
            setData(tasks)
            setSummary(counts)
            setError('')
          })
          .catch((cause) => {
            if (!alive) return
            setError(cause && cause.message ? cause.message : String(cause))
          })
          .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
      }, [filter])

      React.useEffect(() => load(), [load, tick])
      React.useEffect(() => {
        if (!auto) return undefined
        const timer = setInterval(() => setTick((value) => value + 1), REFRESH_MS)
        return () => clearInterval(timer)
      }, [auto])

      const rows = React.useMemo(() => {
        const tasks = (data && data.tasks) || []
        const needle = query.trim().toLowerCase()
        const filtered = needle
          ? tasks.filter((task) =>
            [task.key, task.room, task.text, task.description, task.assignee].join(' ').toLowerCase().includes(needle))
          : tasks
        return filtered.slice().sort((a, b) => {
          if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
          const aDue = a.deadlineAt || Number.MAX_SAFE_INTEGER
          const bDue = b.deadlineAt || Number.MAX_SAFE_INTEGER
          return aDue - bDue
        })
      }, [data, query])

      const chips = [
        ['active', translate('active')],
        ['all', translate('all')],
        ['1', translate('new')],
        ['2', translate('inprogress')],
        ['6', translate('accepted')],
        ['4', translate('postponed')],
      ]

      const now = Date.now()

      return h(
        'div',
        { class: 'tj-page' },
        h('style', null, CSS),
        h(
          'div',
          { class: 'tj-head' },
          h('div', null, h('h1', null, translate('title')), h('p', null, translate('subtitle'))),
          h(
            'div',
            { class: 'tj-actions' },
            h('label', { class: 'tj-chip' + (auto ? ' active' : '') },
              h('input', {
                type: 'checkbox',
                checked: auto,
                onChange: (event) => setAuto(event.target.checked),
                style: { marginRight: '6px', verticalAlign: 'middle' },
              }),
              translate('auto')),
            h('button', { class: 'tj-button', onClick: () => setTick((value) => value + 1), disabled: loading }, translate('refresh')),
          ),
        ),

        error ? h(ErrorBox, { t: translate, error, onRetry: () => setTick((value) => value + 1) }) : null,

        h(
          'div',
          { class: 'tj-kpis' },
          h(Tile, { label: translate('new'), value: summary ? summary.new : null }),
          h(Tile, { label: translate('inprogress'), value: summary ? summary.inprogress : null }),
          h(Tile, { label: translate('accepted'), value: summary ? summary.accepted : null, tone: 'accepted' }),
          h(Tile, { label: translate('postponed'), value: summary ? summary.postponed : null }),
          h(Tile, { label: translate('urgent'), value: summary ? summary.urgentOnPage : null, tone: 'urgent' }),
        ),

        h(
          'div',
          { class: 'tj-bar' },
          h('input', {
            class: 'tj-input',
            placeholder: translate('search'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          chips.map(([id, label]) =>
            h('button', {
              key: id,
              class: 'tj-chip' + (filter === id ? ' active' : ''),
              onClick: () => setFilter(id),
            }, label)),
        ),

        rows.length
          ? h(
            'table',
            { class: 'tj-table' },
            h('thead', null, h('tr', null,
              h('th', null, translate('colKey')),
              h('th', null, translate('colRoom')),
              h('th', null, translate('colTask')),
              h('th', null, translate('colStatus')),
              h('th', null, translate('colDue')),
              h('th', null, translate('colWho')),
            )),
            h('tbody', null, rows.map((task) => {
              let dueText = '—'
              let dueClass = ''
              if (task.deadlineAt) {
                const delta = task.deadlineAt - now
                const late = delta < 0
                dueText = (late ? translate('late') + ' ' : translate('left') + ' ') + humanMs(delta, translate)
                dueClass = late ? ' late' : delta < 3600000 ? ' soon' : ''
              }
              return h('tr', { key: task.id, class: 'tj-row' },
                h('td', { class: 'tj-key' }, String(task.key || '')),
                h('td', null, task.room || h('span', { class: 'tj-muted' }, '—')),
                h('td', null,
                  h('span', { class: 'tj-title' }, task.text || task.description || '—'),
                  task.urgent ? h('span', { class: 'tj-urgent' }, '● ' + translate('urgent')) : null,
                  h('span', { class: 'tj-note' }, [
                    task.assigneePosition || '',
                    task.commentsCount ? task.commentsCount + ' ' + translate('comments') : '',
                    task.photos ? task.photos + ' ' + translate('photos') : '',
                  ].filter(Boolean).join(' · ')),
                ),
                h('td', null, h('span', { class: 'tj-badge ' + task.statusName }, translate('status' + task.statusName.charAt(0).toUpperCase() + task.statusName.slice(1)))),
                h('td', { class: 'tj-due' + dueClass }, dueText),
                h('td', null, task.assignee || h('span', { class: 'tj-muted' }, translate('noOne'))),
              )
            })),
          )
          : h('p', { class: 'tj-muted' }, loading ? translate('loading') : translate('empty')),

        h(
          'div',
          { class: 'tj-foot' },
          h('span', null, translate('source') + ': ' + BRIDGE + '/teamjet/tasks'),
          h('span', null, '· ' + (data && data.count !== undefined ? data.count : '—') + ' ' + translate('active').toLowerCase()),
          h('a', { href: OPEN_URL, target: '_blank', rel: 'noreferrer' }, translate('open') + ' ↗'),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en, ru }), 'teamjet: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 36,
          label: () => t('panel'),
          locale: NS,
        }, TeamJetIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t }),
        }, TeamJetPage))
      },
    }
  },
})
