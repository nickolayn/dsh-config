window.__ModuleLoader__.load({
  id: '@dsh-local/view-f3397ba6-d12b-47df-93a4-aa5ca4435644',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // #region model
    /**
     * Driver model of the 2027 budget. Every input is a percentage number
     * (`12` means 12%), except CAPEX, which is RUB thousand. Fixed constants
     * come from the base scenario of «Бюджет_2027_финансовая_модель.xlsx».
     */
    const CHANNELS = [
      {
        id: 'retail',
        vol2026: 2950,
        price2026: 190,
        dvol: 12,
        dprice: 6,
        dso: 60,
        season: [6.5, 7.5, 8.5, 8, 7.5, 7.5, 7, 7.5, 9, 10, 10.5, 10.5],
      },
      {
        id: 'tender',
        vol2026: 1400,
        price2026: 135,
        dvol: 12,
        dprice: -2,
        dso: 45,
        season: [8, 8, 9, 8.5, 8, 8, 8.5, 8.5, 8, 8.5, 8.5, 8.5],
      },
      {
        id: 'export',
        vol2026: 420,
        price2026: 164,
        dvol: 18,
        dprice: 2,
        dso: 75,
        season: [8, 8, 9, 9, 8, 8, 8, 8, 9, 9, 8, 8],
      },
      {
        id: 'other',
        vol2026: 180,
        price2026: 239,
        dvol: 5,
        dprice: 3,
        dso: 30,
        season: [7, 8, 9, 8, 8, 8, 8, 8, 9, 9, 9, 9],
      },
    ]

    /** Fixed base-scenario assumptions that the dashboard does not expose as drivers. */
    const FIXED = {
      baseVolume: 4950,
      raw2026: 206400,
      packaging2026: 51600,
      packagingInfl: 6,
      productionPayroll2026: 64500,
      productionHeadcount: 2,
      energy2026: 34400,
      energyInfl: 7,
      energyVariableShare: 50,
      commercialPayroll2026: 95000,
      commercialHeadcount: 5,
      adminPayroll2026: 62000,
      rent2026: 18000,
      rentInfl: 5.5,
      it2026: 12000,
      itInfl: 7,
      audit2026: 9000,
      auditInfl: 5,
      otherAdmin2026: 11000,
      otherAdminInfl: 5.5,
      rnd2026: 38000,
      depreciation2026: 30000,
      capexLife: 5,
      existingDebt: 160000,
      existingRate: 15,
      newLoan: 40000,
      newLoanMonth: 4,
      otherIncome: 5000,
      taxRate: 25,
      openingCash: 40000,
      openingAR: 152000,
      openingInventory: 118000,
      openingAP: 55000,
      dio: 90,
      dpo: 45,
      months: 12,
    }

    /** Inclusive ranges and slider steps for every adjustable driver. */
    const RANGES = {
      dvol: [-30, 30, 0.5],
      dprice: [-30, 30, 0.5],
      rawInfl: [-10, 30, 0.5],
      payrollInfl: [-10, 30, 0.5],
      marketing: [0, 15, 0.1],
      trade: [0, 10, 0.1],
      logistics: [0, 10, 0.1],
      rndGrowth: [-20, 100, 1],
      capex: [0, 200000, 1000],
      newRate: [0, 40, 0.5],
    }

    /** Fresh base-scenario driver set. */
    function defaultInputs() {
      return {
        channels: CHANNELS.map((channel) => ({ dvol: channel.dvol, dprice: channel.dprice })),
        rawInfl: 7.5,
        payrollInfl: 9,
        marketing: 7,
        trade: 3,
        logistics: 3.4,
        rndGrowth: 25,
        capex: 60000,
        newRate: 16,
      }
    }

    function clamp(value, min, max) {
      if (value < min) return min
      if (value > max) return max
      return value
    }

    /**
     * Rebuild a stored driver set into the current shape: unknown fields fall
     * back to their base value and every number is clamped to its range.
     */
    function normalizeInputs(raw) {
      const base = defaultInputs()
      if (raw === null || typeof raw !== 'object') return base
      const out = {
        channels: base.channels.map((channel, index) => {
          const stored = Array.isArray(raw.channels) ? raw.channels[index] : undefined
          const source = stored !== null && typeof stored === 'object' ? stored : {}
          const dvol = Number(source.dvol)
          const dprice = Number(source.dprice)
          return {
            dvol: Number.isFinite(dvol) ? clamp(dvol, RANGES.dvol[0], RANGES.dvol[1]) : channel.dvol,
            dprice: Number.isFinite(dprice) ? clamp(dprice, RANGES.dprice[0], RANGES.dprice[1]) : channel.dprice,
          }
        }),
        rawInfl: base.rawInfl,
        payrollInfl: base.payrollInfl,
        marketing: base.marketing,
        trade: base.trade,
        logistics: base.logistics,
        rndGrowth: base.rndGrowth,
        capex: base.capex,
        newRate: base.newRate,
      }
      for (const key of Object.keys(RANGES)) {
        if (key === 'dvol' || key === 'dprice') continue
        const value = Number(raw[key])
        if (Number.isFinite(value)) out[key] = clamp(value, RANGES[key][0], RANGES[key][1])
      }
      return out
    }

    function sum(values) {
      let total = 0
      for (const value of values) total += value
      return total
    }

    /**
     * Compute the 2027 plan: monthly channel volumes and revenue, cost of
     * sales, OPEX, P&L, working capital, cash and the annual KPI set.
     * @param {ReturnType<typeof defaultInputs>} inputs - driver values.
     */
    function computeModel(inputs) {
      const months = FIXED.months
      const channels = CHANNELS.map((channel, index) => {
        const driver = inputs.channels[index]
        return {
          volume: channel.vol2026 * (1 + driver.dvol / 100),
          price: channel.price2026 * (1 + driver.dprice / 100),
          dso: channel.dso,
          season: channel.season,
        }
      })
      const annualVolume = sum(channels.map((channel) => channel.volume))
      const monthlyVolume = []
      const monthlyRevenue = []
      const monthlyRevenueByChannel = []
      for (let month = 0; month < months; month += 1) {
        const channelVolumes = channels.map((channel) => channel.volume * channel.season[month] / 100)
        const channelRevenue = channelVolumes.map((volume, index) => volume * channels[index].price)
        monthlyVolume.push(sum(channelVolumes))
        monthlyRevenue.push(sum(channelRevenue))
        monthlyRevenueByChannel.push(channelRevenue)
      }
      const annualRevenue = sum(monthlyRevenue)

      const rawPerPack = FIXED.raw2026 / FIXED.baseVolume * (1 + inputs.rawInfl / 100)
      const packagingPerPack = FIXED.packaging2026 / FIXED.baseVolume * (1 + FIXED.packagingInfl / 100)
      const productionPayroll = FIXED.productionPayroll2026
        * (1 + inputs.payrollInfl / 100)
        * (1 + FIXED.productionHeadcount / 100)
      const energy = FIXED.energy2026
        * (1 + FIXED.energyInfl / 100)
        * (1 + FIXED.energyVariableShare / 100 * (annualVolume / FIXED.baseVolume - 1))
      const commercialPayroll = FIXED.commercialPayroll2026
        * (1 + inputs.payrollInfl / 100)
        * (1 + FIXED.commercialHeadcount / 100)
      const adminPayroll = FIXED.adminPayroll2026 * (1 + inputs.payrollInfl / 100)
      const fixedOpexMonthly = (
        commercialPayroll
        + adminPayroll
        + FIXED.rent2026 * (1 + FIXED.rentInfl / 100)
        + FIXED.it2026 * (1 + FIXED.itInfl / 100)
        + FIXED.audit2026 * (1 + FIXED.auditInfl / 100)
        + FIXED.otherAdmin2026 * (1 + FIXED.otherAdminInfl / 100)
        + FIXED.rnd2026 * (1 + inputs.rndGrowth / 100)
      ) / months
      const depreciationMonthly = (FIXED.depreciation2026 + inputs.capex / FIXED.capexLife) / months
      const opexRate = (inputs.marketing + inputs.trade + inputs.logistics) / 100

      const cogs = []
      const opex = []
      const gross = []
      const ebitda = []
      const depreciation = []
      const ebit = []
      const interest = []
      const other = []
      const ebt = []
      const tax = []
      const net = []
      for (let month = 0; month < months; month += 1) {
        const cost = (rawPerPack + packagingPerPack) * monthlyVolume[month]
          + productionPayroll / months
          + energy / months
        cogs.push(cost)
        const operating = fixedOpexMonthly + opexRate * monthlyRevenue[month]
        opex.push(operating)
        const grossProfit = monthlyRevenue[month] - cost
        gross.push(grossProfit)
        const operatingProfit = grossProfit - operating
        ebitda.push(operatingProfit)
        depreciation.push(depreciationMonthly)
        const ebitValue = operatingProfit - depreciationMonthly
        ebit.push(ebitValue)
        const interestValue = -(
          FIXED.existingDebt * FIXED.existingRate / 100
          + (month + 1 >= FIXED.newLoanMonth ? FIXED.newLoan * inputs.newRate / 100 : 0)
        ) / months
        interest.push(interestValue)
        const otherValue = FIXED.otherIncome / months
        other.push(otherValue)
        const preTax = ebitValue + interestValue + otherValue
        ebt.push(preTax)
        const taxValue = -Math.max(0, preTax * FIXED.taxRate / 100)
        tax.push(taxValue)
        net.push(preTax + taxValue)
      }

      const ar = []
      const inventory = []
      const ap = []
      const nwc = []
      const cash = []
      const fcfMonthly = []
      let previousAR = FIXED.openingAR
      let previousInventory = FIXED.openingInventory
      let previousAP = FIXED.openingAP
      let cashBalance = FIXED.openingCash
      let fcf = 0
      for (let month = 0; month < months; month += 1) {
        const receivable = sum(
          monthlyRevenueByChannel[month].map((revenue, index) => revenue * CHANNELS[index].dso),
        ) / 30
        const stock = cogs[month] * FIXED.dio / 30
        const payable = cogs[month] * FIXED.dpo / 30
        ar.push(receivable)
        inventory.push(stock)
        ap.push(payable)
        nwc.push(receivable + stock - payable)
        const operatingCash = ebitda[month]
          - (receivable - previousAR)
          - (stock - previousInventory)
          + (payable - previousAP)
          + tax[month]
          + interest[month]
          + other[month]
        const capexMonthly = inputs.capex / months
        const financing = month + 1 === FIXED.newLoanMonth ? FIXED.newLoan : 0
        const freeCash = operatingCash - capexMonthly
        fcfMonthly.push(freeCash)
        fcf += freeCash
        cashBalance += operatingCash - capexMonthly + financing
        cash.push(cashBalance)
        previousAR = receivable
        previousInventory = stock
        previousAP = payable
      }

      const ebitdaAnnual = sum(ebitda)
      const cashEnd = cash[months - 1]
      const netDebt = FIXED.existingDebt + FIXED.newLoan - cashEnd
      const dso = ar[months - 1] / monthlyRevenue[months - 1] * 30
      const dio = inventory[months - 1] / cogs[months - 1] * 30
      const dpo = ap[months - 1] / cogs[months - 1] * 30
      return {
        monthly: {
          revenue: monthlyRevenue,
          volume: monthlyVolume,
          ebitda,
          cash,
        },
        annual: {
          revenue: annualRevenue,
          volume: annualVolume,
          cogs: sum(cogs),
          gross: sum(gross),
          opex: sum(opex),
          ebitda: ebitdaAnnual,
          depreciation: sum(depreciation),
          ebit: sum(ebit),
          interest: sum(interest),
          other: sum(other),
          ebt: sum(ebt),
          tax: sum(tax),
          net: sum(net),
          capex: inputs.capex,
          fcf,
          cashEnd,
          netDebt,
          grossMargin: annualRevenue === 0 ? 0 : sum(gross) / annualRevenue,
          ebitdaMargin: annualRevenue === 0 ? 0 : ebitdaAnnual / annualRevenue,
          netMargin: annualRevenue === 0 ? 0 : sum(net) / annualRevenue,
          leverage: ebitdaAnnual === 0 ? NaN : netDebt / ebitdaAnnual,
          dso,
          dio,
          dpo,
          ccc: dso + dio - dpo,
        },
      }
    }
    // #endregion model

    // #region dictionaries
    const NS = 'budget2027'
    const zh = {
      panel: '2027 年预算',
      pageTitle: '2027 年预算仪表板',
      pageSubtitle: '预算驱动模型 · 千卢布，不含增值税 · 2027',
      kpiTitle: '关键指标',
      revenue: '收入',
      grossMargin: '毛利率',
      ebitdaMargin: 'EBITDA 利润率',
      netProfit: '净利润',
      fcf: '自由现金流 (FCF)',
      netDebtEbitda: '净债务 / EBITDA',
      cashCycle: '现金周期',
      vsBase: '较基准',
      baseScenario: '基准情景',
      driversTitle: '驱动因素',
      channelsTitle: '渠道',
      channelRetail: '药店零售',
      channelTender: '招标与政府采购',
      channelExport: '出口与合同生产',
      channelOther: '其他（连锁药房、自有品牌）',
      volumeGrowth: '销量，2027 对 2026',
      priceGrowth: '价格，2027 对 2026',
      cogsTitle: '销售成本',
      rawInflation: '原材料通胀',
      rawHint: '包装 +6%、能源 +7%（50% 为变动成本）为固定假设。',
      payrollInflation: '薪酬指数化',
      payrollHint: '适用于生产、商务和管理人员薪酬；保留基准情景中的人员增长计划。',
      opexTitle: '运营费用',
      marketing: '市场营销，占收入 %',
      tradeMarketing: '渠道营销，占收入 %',
      logistics: '物流，占收入 %',
      rnd: '研发增长',
      rndHint: '研发与产品注册。',
      capexTitle: '投资与债务',
      capexLabel: '2027 年 CAPEX',
      capexHint: '新增固定资产按 5 年折旧。',
      loanRate: '新增贷款利率',
      loanHint: '4 月新增贷款 40 000 千卢布；现有债务 160 000，利率 15%。',
      monthlyTitle: '2027 年月度收入',
      monthlyTotal: '全年合计',
      legendCurrent: '当前情景',
      legendBase: '基准情景',
      reset: '恢复基准情景',
      resetDone: '已恢复基准情景',
      saved: '已保存在此电脑上',
      storageUnavailable: '无法保存到此浏览器',
      note: '情景数据保存在此电脑的浏览器中，下次打开时自动恢复。',
      baseNote: '起始数据来自《Бюджет_2027_финансовая_модель.xlsx》基准情景。',
      na: '—',
      unitThousandRub: '千卢布',
      unitThousandPack: '千包',
      unitRubPack: '卢布/包',
      unitDays: '天',
      unitPp: '个百分点',
      month1: '1月',
      month2: '2月',
      month3: '3月',
      month4: '4月',
      month5: '5月',
      month6: '6月',
      month7: '7月',
      month8: '8月',
      month9: '9月',
      month10: '10月',
      month11: '11月',
      month12: '12月',
    }
    const en = {
      panel: 'Budget 2027',
      pageTitle: '2027 budget dashboard',
      pageSubtitle: 'Driver-based budget model · RUB thousand, excl. VAT · 2027',
      kpiTitle: 'Key metrics',
      revenue: 'Revenue',
      grossMargin: 'Gross margin',
      ebitdaMargin: 'EBITDA margin',
      netProfit: 'Net profit',
      fcf: 'Free cash flow (FCF)',
      netDebtEbitda: 'Net debt / EBITDA',
      cashCycle: 'Cash conversion cycle',
      vsBase: 'vs base',
      baseScenario: 'Base scenario',
      driversTitle: 'Drivers',
      channelsTitle: 'Channels',
      channelRetail: 'Pharmacy retail',
      channelTender: 'Tenders and public procurement',
      channelExport: 'Export and contract manufacturing',
      channelOther: 'Other (pharmacy chains, private label)',
      volumeGrowth: 'Volume, 2027 vs 2026',
      priceGrowth: 'Price, 2027 vs 2026',
      cogsTitle: 'Cost of sales',
      rawInflation: 'Raw-material inflation',
      rawHint: 'Packaging +6%, energy +7% (50% variable) are fixed.',
      payrollInflation: 'Payroll indexation',
      payrollHint: 'Applies to production, commercial and administrative payroll; the base plan\'s headcount growth is kept.',
      opexTitle: 'Operating expenses',
      marketing: 'Marketing, % of revenue',
      tradeMarketing: 'Trade marketing, % of revenue',
      logistics: 'Logistics, % of revenue',
      rnd: 'R&D growth',
      rndHint: 'R&D and product registration.',
      capexTitle: 'Investment and debt',
      capexLabel: 'CAPEX 2027',
      capexHint: 'New fixed assets are depreciated over 5 years.',
      loanRate: 'New-loan rate',
      loanHint: 'New loan 40,000 in April; existing debt 160,000 at 15%.',
      monthlyTitle: 'Monthly revenue 2027',
      monthlyTotal: 'Year total',
      legendCurrent: 'Current scenario',
      legendBase: 'Base scenario',
      reset: 'Reset to base',
      resetDone: 'Base scenario restored',
      saved: 'Saved on this computer',
      storageUnavailable: 'Could not save in this browser',
      note: 'Scenario values are saved in this browser on this computer and restored the next time you open the page.',
      baseNote: 'Starting values come from the base scenario of «Бюджет_2027_финансовая_модель.xlsx».',
      na: '—',
      unitThousandRub: 'RUB thousand',
      unitThousandPack: 'thousand packs',
      unitRubPack: 'RUB/pack',
      unitDays: 'days',
      unitPp: 'pp',
      month1: 'Jan',
      month2: 'Feb',
      month3: 'Mar',
      month4: 'Apr',
      month5: 'May',
      month6: 'Jun',
      month7: 'Jul',
      month8: 'Aug',
      month9: 'Sep',
      month10: 'Oct',
      month11: 'Nov',
      month12: 'Dec',
    }
    const ru = {
      panel: 'Бюджет 2027',
      pageTitle: 'Дашборд бюджета 2027',
      pageSubtitle: 'Драйверная модель бюджета · тыс. руб. без НДС · 2027',
      kpiTitle: 'Ключевые показатели',
      revenue: 'Выручка',
      grossMargin: 'Валовая маржа',
      ebitdaMargin: 'EBITDA-маржа',
      netProfit: 'Чистая прибыль',
      fcf: 'Свободный денежный поток (FCF)',
      netDebtEbitda: 'Чистый долг / EBITDA',
      cashCycle: 'Денежный цикл',
      vsBase: 'к базовому',
      baseScenario: 'Базовый сценарий',
      driversTitle: 'Драйверы',
      channelsTitle: 'Каналы',
      channelRetail: 'Аптечная розница',
      channelTender: 'Тендеры и госзакупки',
      channelExport: 'Экспорт и контрактное производство',
      channelOther: 'Прочее (аптечные сети, СТМ)',
      volumeGrowth: 'Объём, 2027 к 2026',
      priceGrowth: 'Цена, 2027 к 2026',
      cogsTitle: 'Себестоимость',
      rawInflation: 'Инфляция сырья',
      rawHint: 'Упаковка +6%, энергия +7% (50% переменных) — фиксировано.',
      payrollInflation: 'Индексация ФОТ',
      payrollHint: 'Применяется к ФОТ производства, коммерции и АУП; плановый прирост штата базового сценария сохранён.',
      opexTitle: 'Операционные расходы',
      marketing: 'Маркетинг, % выручки',
      tradeMarketing: 'Трейд-маркетинг, % выручки',
      logistics: 'Логистика, % выручки',
      rnd: 'НИОКР, рост',
      rndHint: 'НИОКР и регистрация препаратов.',
      capexTitle: 'Инвестиции и долг',
      capexLabel: 'CAPEX 2027',
      capexHint: 'Новые ОС амортизируются 5 лет.',
      loanRate: 'Ставка по новому кредиту',
      loanHint: 'Новый кредит 40 000 тыс. руб. в апреле; действующий долг 160 000 под 15%.',
      monthlyTitle: 'Помесячная выручка 2027',
      monthlyTotal: 'Итого за год',
      legendCurrent: 'Текущий сценарий',
      legendBase: 'Базовый сценарий',
      reset: 'Сбросить к базовому',
      resetDone: 'Восстановлен базовый сценарий',
      saved: 'Сохранено на этом компьютере',
      storageUnavailable: 'Не удалось сохранить в этом браузере',
      note: 'Значения сценария сохраняются в этом браузере на этом компьютере и восстанавливаются при следующем открытии.',
      baseNote: 'Стартовые значения — базовый сценарий «Бюджет_2027_финансовая_модель.xlsx».',
      na: '—',
      unitThousandRub: 'тыс. руб.',
      unitThousandPack: 'тыс. упак.',
      unitRubPack: 'руб/упак.',
      unitDays: 'дн.',
      unitPp: 'п.п.',
      month1: 'Янв',
      month2: 'Фев',
      month3: 'Мар',
      month4: 'Апр',
      month5: 'Май',
      month6: 'Июн',
      month7: 'Июл',
      month8: 'Авг',
      month9: 'Сен',
      month10: 'Окт',
      month11: 'Ноя',
      month12: 'Дек',
    }
    // #endregion dictionaries

    // #region view
    const PANEL_ID = '@dsh-local/view-f3397ba6-d12b-47df-93a4-aa5ca4435644:budget-2027'
    const STORAGE_KEY = 'dsh.budget2027.scenario.v1'
    const num0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
    const num1 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    const num2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    function formatMoney(value) {
      return Number.isFinite(value) ? num0.format(Math.round(value)) : '—'
    }

    function formatPercent(value) {
      return Number.isFinite(value) ? `${num1.format(value * 100)}%` : '—'
    }

    function formatMultiple(value) {
      return Number.isFinite(value) ? `${num2.format(value)}×` : '—'
    }

    function formatDays(value) {
      return Number.isFinite(value) ? num0.format(Math.round(value)) : '—'
    }

    function signed(value, formatter) {
      if (!Number.isFinite(value)) return '—'
      const magnitude = formatter.format(Math.abs(value))
      if (value > 0) return `+${magnitude}`
      if (value < 0) return `−${magnitude}`
      return magnitude
    }

    function readStoredInputs() {
      try {
        if (typeof localStorage === 'undefined') return defaultInputs()
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return defaultInputs()
        return normalizeInputs(JSON.parse(raw))
      } catch (error) {
        return defaultInputs()
      }
    }

    function writeStoredInputs(inputs) {
      try {
        if (typeof localStorage === 'undefined') return false
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs))
        return true
      } catch (error) {
        // Storage can be unavailable (private mode, quota); the page keeps working in memory.
        return false
      }
    }

    /** Left-sidebar glyph: three rising columns of the plan. */
    function BudgetIcon({ size }) {
      const edge = Number.isFinite(size) ? size : 16
      return h(
        'svg',
        {
          viewBox: '0 0 36 36',
          width: edge,
          height: edge,
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block' },
        },
        h('rect', { x: 5, y: 21, width: 6, height: 9, rx: 1.5, fill: 'currentColor', opacity: 0.55 }),
        h('rect', { x: 15, y: 15, width: 6, height: 15, rx: 1.5, fill: 'currentColor', opacity: 0.78 }),
        h('rect', { x: 25, y: 8, width: 6, height: 22, rx: 1.5, fill: 'currentColor' }),
      )
    }

    /**
     * A number field that keeps an in-progress draft while focused so partial
     * entries such as `7.` are not rewritten, and commits a clamped value.
     */
    function NumberField({ id, label, value, min, max, step, onChange }) {
      const [draft, setDraft] = React.useState(String(value))
      const [focused, setFocused] = React.useState(false)
      React.useEffect(() => {
        if (!focused) setDraft(String(value))
      }, [value, focused])
      return h('input', {
        id,
        className: 'b27-number',
        type: 'number',
        inputMode: 'decimal',
        value: focused ? draft : String(value),
        min,
        max,
        step,
        'aria-label': label,
        onFocus: () => {
          setFocused(true)
          setDraft(String(value))
        },
        onChange: (event) => {
          const next = event.target.value
          setDraft(next)
          const parsed = Number(next)
          if (next.trim() !== '' && Number.isFinite(parsed)) onChange(clamp(parsed, min, max))
        },
        onBlur: () => {
          const parsed = Number(draft)
          setFocused(false)
          if (draft.trim() === '' || !Number.isFinite(parsed)) {
            setDraft(String(value))
            return
          }
          onChange(clamp(parsed, min, max))
        },
      })
    }

    /** One labelled slider with its numeric input and optional explanatory hint. */
    function DriverField({ id, label, hint, value, min, max, step, suffix, onChange }) {
      return h(
        'div',
        { className: 'b27-field' },
        h(
          'div',
          { className: 'b27-fieldTop' },
          h('label', { className: 'b27-fieldLabel', htmlFor: `b27-${id}-number` }, label),
          h(
            'span',
            { className: 'b27-fieldValue' },
            h(NumberField, {
              id: `b27-${id}-number`,
              label,
              value,
              min,
              max,
              step,
              onChange,
            }),
            suffix === '' ? null : h('span', { className: 'b27-suffix' }, suffix),
          ),
        ),
        h('input', {
          className: 'b27-range',
          type: 'range',
          min,
          max,
          step,
          value: String(value),
          'aria-label': label,
          onChange: (event) => onChange(clamp(Number(event.target.value), min, max)),
        }),
        hint ? h('div', { className: 'b27-hint' }, hint) : null,
      )
    }

    function DeltaLine({ tone, text, title }) {
      return h('div', { className: `b27-kpiDelta b27-${tone}`, title }, text)
    }

    /**
     * The dashboard page: KPI cards recomputed from the driver state, the
     * driver controls, and the monthly revenue chart against the base plan.
     */
    function BudgetPage({ t }) {
      const translate = typeof t === 'function' ? t : (key) => (ru[key] === undefined ? key : ru[key])
      const [inputs, setInputs] = React.useState(readStoredInputs)
      const [notice, setNotice] = React.useState('')
      const [storageFailed, setStorageFailed] = React.useState(false)
      const noticeTimer = React.useRef(null)
      const baseModel = React.useMemo(() => computeModel(defaultInputs()), [])
      const model = React.useMemo(() => computeModel(inputs), [inputs])
      const isBase = React.useMemo(
        () => JSON.stringify(inputs) === JSON.stringify(defaultInputs()),
        [inputs],
      )

      React.useEffect(() => {
        const timer = setTimeout(() => {
          setStorageFailed(!writeStoredInputs(inputs))
        }, 250)
        return () => clearTimeout(timer)
      }, [inputs])

      // A pending debounce must not lose the last edit when the user leaves the page.
      const latestInputs = React.useRef(inputs)
      latestInputs.current = inputs
      React.useEffect(() => () => writeStoredInputs(latestInputs.current), [])

      React.useEffect(() => () => {
        if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
      }, [])

      const showNotice = (message) => {
        setNotice(message)
        if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => setNotice(''), 2600)
      }

      const update = (patch) => setInputs((previous) => ({ ...previous, ...patch }))
      const updateChannel = (index, patch) => setInputs((previous) => ({
        ...previous,
        channels: previous.channels.map((channel, position) => (
          position === index ? { ...channel, ...patch } : channel
        )),
      }))

      const current = model.annual
      const base = baseModel.annual
      const moneyDeltaTone = (now, then) => {
        if (!Number.isFinite(now) || !Number.isFinite(then)) return 'neutral'
        if (Math.abs(now - then) < 1e-9) return 'neutral'
        return now > then ? 'good' : 'bad'
      }
      const marginDeltaTone = (now, then) => {
        if (!Number.isFinite(now) || !Number.isFinite(then)) return 'neutral'
        if (Math.abs(now - then) < 1e-9) return 'neutral'
        return now > then ? 'good' : 'bad'
      }
      const lowerDeltaTone = (now, then) => {
        if (!Number.isFinite(now) || !Number.isFinite(then)) return 'neutral'
        if (Math.abs(now - then) < 1e-9) return 'neutral'
        return now < then ? 'good' : 'bad'
      }

      const moneyDelta = (now, then) => {
        if (!Number.isFinite(now) || !Number.isFinite(then)) return translate('na')
        if (then > 0) return `${signed((now / then - 1) * 100, num1)}% ${translate('vsBase')}`
        return `${signed(now - then, num0)} ${translate('unitThousandRub')} ${translate('vsBase')}`
      }
      const ppDelta = (now, then) => {
        if (!Number.isFinite(now) || !Number.isFinite(then)) return translate('na')
        return `${signed((now - then) * 100, num1)} ${translate('unitPp')} ${translate('vsBase')}`
      }
      const daysDelta = (now, then) => {
        if (!Number.isFinite(now) || !Number.isFinite(then)) return translate('na')
        return `${signed(now - then, num1)} ${translate('unitDays')} ${translate('vsBase')}`
      }
      const multipleDelta = (now, then) => {
        if (!Number.isFinite(now) || !Number.isFinite(then)) return translate('na')
        return `${signed(now - then, num2)}× ${translate('vsBase')}`
      }

      const kpis = [
        {
          key: 'revenue',
          label: translate('revenue'),
          value: formatMoney(current.revenue),
          unit: translate('unitThousandRub'),
          tone: moneyDeltaTone(current.revenue, base.revenue),
          text: moneyDelta(current.revenue, base.revenue),
          title: `${translate('baseScenario')}: ${formatMoney(base.revenue)} ${translate('unitThousandRub')}`,
        },
        {
          key: 'grossMargin',
          label: translate('grossMargin'),
          value: formatPercent(current.grossMargin),
          unit: '',
          tone: marginDeltaTone(current.grossMargin, base.grossMargin),
          text: ppDelta(current.grossMargin, base.grossMargin),
          title: `${translate('baseScenario')}: ${formatPercent(base.grossMargin)}`,
        },
        {
          key: 'ebitdaMargin',
          label: translate('ebitdaMargin'),
          value: formatPercent(current.ebitdaMargin),
          unit: '',
          tone: marginDeltaTone(current.ebitdaMargin, base.ebitdaMargin),
          text: ppDelta(current.ebitdaMargin, base.ebitdaMargin),
          title: `${translate('baseScenario')}: ${formatPercent(base.ebitdaMargin)}`,
        },
        {
          key: 'netProfit',
          label: translate('netProfit'),
          value: formatMoney(current.net),
          unit: translate('unitThousandRub'),
          tone: moneyDeltaTone(current.net, base.net),
          text: moneyDelta(current.net, base.net),
          title: `${translate('baseScenario')}: ${formatMoney(base.net)} ${translate('unitThousandRub')}`,
        },
        {
          key: 'fcf',
          label: translate('fcf'),
          value: formatMoney(current.fcf),
          unit: translate('unitThousandRub'),
          tone: moneyDeltaTone(current.fcf, base.fcf),
          text: moneyDelta(current.fcf, base.fcf),
          title: `${translate('baseScenario')}: ${formatMoney(base.fcf)} ${translate('unitThousandRub')}`,
        },
        {
          key: 'netDebtEbitda',
          label: translate('netDebtEbitda'),
          value: formatMultiple(current.leverage),
          unit: '',
          tone: lowerDeltaTone(current.leverage, base.leverage),
          text: multipleDelta(current.leverage, base.leverage),
          title: `${translate('baseScenario')}: ${formatMultiple(base.leverage)}`,
        },
        {
          key: 'cashCycle',
          label: translate('cashCycle'),
          value: formatDays(current.ccc),
          unit: translate('unitDays'),
          tone: lowerDeltaTone(current.ccc, base.ccc),
          text: daysDelta(current.ccc, base.ccc),
          title: `${translate('baseScenario')}: ${formatDays(base.ccc)} ${translate('unitDays')}`,
        },
      ]

      const monthly = model.monthly.revenue
      const monthlyBase = baseModel.monthly.revenue
      const chartMax = Math.max(1, ...monthly, ...monthlyBase)
      const chartTotal = current.revenue
      const chartDelta = moneyDelta(current.revenue, base.revenue)

      const reset = () => {
        setInputs(defaultInputs())
        showNotice(translate('resetDone'))
      }

      const channelCards = CHANNELS.map((channel, index) => {
        const driver = inputs.channels[index]
        const volume2027 = channel.vol2026 * (1 + driver.dvol / 100)
        const price2027 = channel.price2026 * (1 + driver.dprice / 100)
        const nameKey = index === 0 ? 'channelRetail' : index === 1 ? 'channelTender'
          : index === 2 ? 'channelExport' : 'channelOther'
        return h(
          'div',
          { className: 'b27-channel', key: channel.id },
          h('div', { className: 'b27-channelName' }, translate(nameKey)),
          h(
            'div',
            { className: 'b27-channelMeta' },
            `${num0.format(Math.round(volume2027))} ${translate('unitThousandPack')} · ${num1.format(price2027)} ${translate('unitRubPack')}`,
          ),
          h(DriverField, {
            id: `${channel.id}-volume`,
            label: translate('volumeGrowth'),
            value: driver.dvol,
            min: RANGES.dvol[0],
            max: RANGES.dvol[1],
            step: RANGES.dvol[2],
            suffix: '%',
            onChange: (value) => updateChannel(index, { dvol: value }),
          }),
          h(DriverField, {
            id: `${channel.id}-price`,
            label: translate('priceGrowth'),
            value: driver.dprice,
            min: RANGES.dprice[0],
            max: RANGES.dprice[1],
            step: RANGES.dprice[2],
            suffix: '%',
            onChange: (value) => updateChannel(index, { dprice: value }),
          }),
        )
      })

      return h(
        'div',
        { className: 'b27-root' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'b27-inner' },
          h(
            'header',
            { className: 'b27-head' },
            h(
              'div',
              { className: 'b27-headText' },
              h('h1', { className: 'b27-title' }, translate('pageTitle')),
              h('p', { className: 'b27-sub' }, translate('pageSubtitle')),
            ),
            h(
              'div',
              { className: 'b27-actions' },
              h(
                'span',
                { className: 'b27-status', 'aria-live': 'polite' },
                h('span', { className: 'b27-statusDot', 'aria-hidden': 'true' }),
                notice === ''
                  ? (storageFailed ? translate('storageUnavailable') : translate('saved'))
                  : notice,
              ),
              h(
                'button',
                { type: 'button', className: 'b27-reset', onClick: reset },
                translate('reset'),
              ),
            ),
          ),
          h(
            'section',
            { className: 'b27-kpis', 'aria-label': translate('kpiTitle') },
            kpis.map((kpi) => h(
              'article',
              { className: 'b27-kpi', key: kpi.key },
              h('div', { className: 'b27-kpiLabel' }, kpi.label),
              h(
                'div',
                { className: 'b27-kpiValue' },
                kpi.value,
                kpi.unit === '' ? null : h('span', { className: 'b27-kpiUnit' }, kpi.unit),
              ),
              h(DeltaLine, { tone: kpi.tone, text: kpi.text, title: kpi.title }),            )),
          ),
          h(
            'div',
            { className: 'b27-cols' },
            h(
              'section',
              { className: 'b27-panel', 'aria-label': translate('driversTitle') },
              h('h2', { className: 'b27-h2' }, translate('driversTitle')),
              h(
                'div',
                { className: 'b27-section' },
                h('div', { className: 'b27-sectionTitle' }, translate('channelsTitle')),
                channelCards,
              ),
              h(
                'div',
                { className: 'b27-section' },
                h('div', { className: 'b27-sectionTitle' }, translate('cogsTitle')),
                h(DriverField, {
                  id: 'raw',
                  label: translate('rawInflation'),
                  hint: translate('rawHint'),
                  value: inputs.rawInfl,
                  min: RANGES.rawInfl[0],
                  max: RANGES.rawInfl[1],
                  step: RANGES.rawInfl[2],
                  suffix: '%',
                  onChange: (value) => update({ rawInfl: value }),
                }),
                h(DriverField, {
                  id: 'payroll',
                  label: translate('payrollInflation'),
                  hint: translate('payrollHint'),
                  value: inputs.payrollInfl,
                  min: RANGES.payrollInfl[0],
                  max: RANGES.payrollInfl[1],
                  step: RANGES.payrollInfl[2],
                  suffix: '%',
                  onChange: (value) => update({ payrollInfl: value }),
                }),
              ),
              h(
                'div',
                { className: 'b27-section' },
                h('div', { className: 'b27-sectionTitle' }, translate('opexTitle')),
                h(DriverField, {
                  id: 'marketing',
                  label: translate('marketing'),
                  value: inputs.marketing,
                  min: RANGES.marketing[0],
                  max: RANGES.marketing[1],
                  step: RANGES.marketing[2],
                  suffix: '%',
                  onChange: (value) => update({ marketing: value }),
                }),
                h(DriverField, {
                  id: 'trade',
                  label: translate('tradeMarketing'),
                  value: inputs.trade,
                  min: RANGES.trade[0],
                  max: RANGES.trade[1],
                  step: RANGES.trade[2],
                  suffix: '%',
                  onChange: (value) => update({ trade: value }),
                }),
                h(DriverField, {
                  id: 'logistics',
                  label: translate('logistics'),
                  value: inputs.logistics,
                  min: RANGES.logistics[0],
                  max: RANGES.logistics[1],
                  step: RANGES.logistics[2],
                  suffix: '%',
                  onChange: (value) => update({ logistics: value }),
                }),
                h(DriverField, {
                  id: 'rnd',
                  label: translate('rnd'),
                  hint: translate('rndHint'),
                  value: inputs.rndGrowth,
                  min: RANGES.rndGrowth[0],
                  max: RANGES.rndGrowth[1],
                  step: RANGES.rndGrowth[2],
                  suffix: '%',
                  onChange: (value) => update({ rndGrowth: value }),
                }),
              ),
              h(
                'div',
                { className: 'b27-section' },
                h('div', { className: 'b27-sectionTitle' }, translate('capexTitle')),
                h(DriverField, {
                  id: 'capex',
                  label: translate('capexLabel'),
                  hint: translate('capexHint'),
                  value: inputs.capex,
                  min: RANGES.capex[0],
                  max: RANGES.capex[1],
                  step: RANGES.capex[2],
                  suffix: translate('unitThousandRub'),
                  onChange: (value) => update({ capex: value }),
                }),
                h(DriverField, {
                  id: 'loan-rate',
                  label: translate('loanRate'),
                  hint: translate('loanHint'),
                  value: inputs.newRate,
                  min: RANGES.newRate[0],
                  max: RANGES.newRate[1],
                  step: RANGES.newRate[2],
                  suffix: '%',
                  onChange: (value) => update({ newRate: value }),
                }),
              ),
            ),
            h(
              'section',
              { className: 'b27-panel', 'aria-label': translate('monthlyTitle') },
              h(
                'div',
                { className: 'b27-panelHead' },
                h('h2', { className: 'b27-h2' }, translate('monthlyTitle')),
                h(
                  'span',
                  { className: 'b27-chartTotal' },
                  `${translate('monthlyTotal')}: ${formatMoney(chartTotal)} ${translate('unitThousandRub')}`,
                ),
              ),
              h(
                'div',
                { className: 'b27-legend' },
                h('span', { className: 'b27-legendItem' }, h('span', { className: 'b27-swatch b27-swatchBar', 'aria-hidden': 'true' }), translate('legendCurrent')),
                h('span', { className: 'b27-legendItem' }, h('span', { className: 'b27-swatch b27-swatchBase', 'aria-hidden': 'true' }), translate('legendBase')),
                isBase ? null : h('span', { className: 'b27-chartDelta' }, chartDelta),
              ),
              h(
                'div',
                { className: 'b27-chart', role: 'list', 'aria-label': translate('monthlyTitle') },
                monthly.map((value, index) => h(
                  'div',
                  {
                    className: 'b27-chartCol',
                    key: `month-${index + 1}`,
                    role: 'listitem',
                    title: `${translate(`month${index + 1}`)}: ${formatMoney(value)} ${translate('unitThousandRub')} · ${translate('baseScenario')}: ${formatMoney(monthlyBase[index])}`,
                    'aria-label': `${translate(`month${index + 1}`)}: ${formatMoney(value)} ${translate('unitThousandRub')}, ${translate('baseScenario')}: ${formatMoney(monthlyBase[index])}`,
                  },
                  h(
                    'div',
                    { className: 'b27-barTrack' },
                    h('div', {
                      className: 'b27-bar',
                      style: { height: `${Math.max(1.5, value / chartMax * 100)}%` },
                    }),
                    h('div', {
                      className: 'b27-baseMark',
                      style: { bottom: `${monthlyBase[index] / chartMax * 100}%` },
                    }),
                  ),
                  h('div', { className: 'b27-monthValue' }, formatMoney(value)),
                  h('div', { className: 'b27-month' }, translate(`month${index + 1}`)),
                )),
              ),
            ),
          ),
          h(
            'footer',
            { className: 'b27-footer' },
            h('p', { className: 'b27-note' }, translate('note')),
            h('p', { className: 'b27-note' }, translate('baseNote')),
          ),
        ),
      )
    }

    const CSS = `
.b27-root {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  padding: 28px clamp(20px, 4vw, 48px) 56px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.4;
}
.b27-inner {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.b27-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.b27-headText { min-width: 0; }
.b27-title {
  margin: 0;
  font-size: 20px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.b27-sub {
  margin: 5px 0 0;
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary);
}
.b27-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.b27-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}
.b27-statusDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary);
  flex: none;
}
.b27-reset {
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  padding: 6px 11px;
  cursor: pointer;
}
.b27-reset:hover { background: var(--dsw-alias-interactive-bg-hover); }
.b27-reset:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
.b27-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
  gap: 10px;
}
.b27-kpi {
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-layer-1);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 98px;
}
.b27-kpiLabel {
  font-size: 11.5px;
  line-height: 1.3;
  color: var(--dsw-alias-label-secondary);
}
.b27-kpiValue {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 22px;
  line-height: 1.15;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.b27-kpiUnit {
  font-size: 10.5px;
  font-weight: 400;
  color: var(--dsw-alias-label-tertiary);
  letter-spacing: 0;
}
.b27-kpiDelta {
  font-size: 11px;
  line-height: 1.3;
  color: var(--dsw-alias-label-tertiary);
  margin-top: auto;
}
.b27-good { color: var(--dsw-alias-state-success-primary); }
.b27-bad { color: var(--dsw-alias-state-error-primary); }
.b27-neutral { color: var(--dsw-alias-label-tertiary); }
.b27-cols {
  display: grid;
  grid-template-columns: minmax(300px, 392px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
@media (max-width: 900px) {
  .b27-cols { grid-template-columns: minmax(0, 1fr); }
}
.b27-panel {
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-layer-1);
  padding: 14px 16px 16px;
  min-width: 0;
}
.b27-h2 {
  margin: 0 0 12px;
  font-size: 13.5px;
  font-weight: 600;
}
.b27-section {
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  margin-top: 12px;
  padding-top: 12px;
}
.b27-section:first-of-type {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}
.b27-sectionTitle {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--dsw-alias-label-tertiary);
  margin-bottom: 10px;
}
.b27-field { margin-bottom: 11px; }
.b27-field:last-child { margin-bottom: 0; }
.b27-fieldTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.b27-fieldLabel {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  min-width: 0;
}
.b27-fieldValue {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: none;
}
.b27-number {
  width: 62px;
  box-sizing: border-box;
  padding: 3px 5px;
  text-align: right;
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-3);
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-sm, 6px);
}
.b27-number:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 0;
}
.b27-suffix {
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary);
  min-width: 12px;
}
.b27-range {
  display: block;
  width: 100%;
  height: 18px;
  margin: 3px 0 0;
  accent-color: var(--dsw-alias-state-business-primary);
  cursor: pointer;
}
.b27-range:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.b27-hint {
  margin-top: 3px;
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--dsw-alias-label-tertiary);
}
.b27-channel {
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-2);
  padding: 10px 11px 11px;
  margin-bottom: 9px;
}
.b27-channel:last-child { margin-bottom: 0; }
.b27-channelName {
  font-size: 12px;
  font-weight: 500;
}
.b27-channelMeta {
  margin: 1px 0 8px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}
.b27-channel .b27-field { margin-bottom: 9px; }
.b27-panelHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.b27-chartTotal {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.b27-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin: 8px 0 10px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary);
}
.b27-legendItem {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.b27-swatch {
  display: inline-block;
  flex: none;
}
.b27-swatchBar {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: var(--dsw-alias-state-business-primary);
}
.b27-swatchBase {
  width: 12px;
  height: 2px;
  border-radius: 1px;
  background: var(--dsw-alias-label-caption);
}
.b27-chartDelta {
  margin-left: auto;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.b27-chart {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 5px;
  height: 220px;
  padding-top: 6px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l3);
  box-sizing: border-box;
}
.b27-chartCol {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
  gap: 5px;
  min-width: 0;
  height: 100%;
}
.b27-barTrack {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.b27-bar {
  width: min(100%, 24px);
  border-radius: 4px 4px 0 0;
  background: var(--dsw-alias-state-business-primary);
  background: linear-gradient(
    180deg,
    var(--dsw-alias-state-business-primary),
    color-mix(in srgb, var(--dsw-alias-state-business-primary) 52%, transparent)
  );
  min-height: 2px;
}
.b27-baseMark {
  position: absolute;
  left: 8%;
  right: 8%;
  height: 2px;
  border-radius: 1px;
  background: var(--dsw-alias-label-caption);
  opacity: 0.9;
  pointer-events: none;
}
.b27-monthValue {
  flex: none;
  text-align: center;
  font-size: 9px;
  line-height: 1.2;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
}
@media (max-width: 720px) {
  .b27-monthValue { display: none; }
}
.b27-month {
  flex: none;
  text-align: center;
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.b27-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.b27-note {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.45;
  color: var(--dsw-alias-label-tertiary);
}
`
    // #endregion view

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en, ru }), 'budget-2027: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          label: () => t('panel'),
          locale: NS,
        }, BudgetIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t }),
        }, BudgetPage))
      },
    }
  },
})
