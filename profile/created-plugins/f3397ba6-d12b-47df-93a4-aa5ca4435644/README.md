# Budget 2027 dashboard

A left-sidebar page for the 2027 budget of the base scenario in
`Бюджет_2027_финансовая_модель.xlsx` (RUB thousand, 2027). The financial
director changes drivers and the dashboard recalculates on every edit:

- volumes and prices of four channels (pharmacy retail, tenders, export and
  contract manufacturing, other);
- raw-material inflation and payroll indexation;
- marketing, trade marketing and logistics as a share of revenue;
- R&D growth, CAPEX, and the rate on the new loan.

It shows revenue, gross margin, EBITDA margin, net profit, FCF, net
debt/EBITDA and the cash conversion cycle, each with its deviation from the
base scenario, plus monthly 2027 revenue against the base plan.

## Where it opens

Left sidebar → **Бюджет 2027**. The page replaces the conversation area; the
conversation remains reachable by selecting it in the sidebar.

## Model

The model follows the workbook's base scenario: channel volumes and prices,
seasonality, unit raw-material and packaging costs, energy with a 50% variable
share, OPEX lines, depreciation of new fixed assets over five years, interest
on the existing debt at 15% plus the new loan of 40,000 drawn in April,
25% profit tax, and working capital on the December run-rate (DSO by channel,
DIO 90 days, DPO 45 days).

Fixed assumptions that the dashboard does not expose: packaging inflation 6%,
energy inflation 7%, planned headcount growth of the base scenario
(+2% production, +5% commercial), rent/IT/audit/other administrative
indexation, and the existing debt terms.

## Persistence

Driver values are saved in this browser on this computer
(`localStorage`, key `dsh.budget2027.scenario.v1`) and restored on the next
visit. **Сбросить к базовому** restores the base scenario.

## Limitations

- One scenario only: there is no scenario library, export, or history.
- The workbook itself is not read at runtime; its base data is embedded.
- Calculations use the dashboard's own formulas. The cash cycle uses the
  December run-rate (the model's stated working-capital method); the
  workbook's KPI page annualises it differently.
