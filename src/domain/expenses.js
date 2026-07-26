export function fixedExpensesTotal(fixedExpenses) {
            return (fixedExpenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
          }

// Total of every fund's monthly SIP amount (liquid + equity — the Manage
// SIPs modal allows both). SIPs auto-debit from the same bank account
// bankSpentThisMonth() diffs, so like fixed expenses they're a planned
// chunk of that drop, not a separate outflow layered on top of it.
export function totalMonthlySip(liqFunds, eqFunds, liquid, equity) {
            let total = 0;
            liqFunds.forEach(f => { total += liquid[f.id]?.sipAmt || 0; });
            eqFunds.forEach(f => { total += equity[f.id]?.sipAmt || 0; });
            return total;
          }

// Bank spend this month = the most recent monthly snapshot's Bank balance
// (the month's opening figure) minus the live Bank value on the Net Worth
// tab's Enter Values section (today's balance) — reuses that field rather
// than tracking a second, easily-drifting copy of "current bank balance".
// Clamped to 0 so a mid-month deposit (salary credit, etc.) never reads as
// negative spending.
export function bankSpentThisMonth(networth) {
            const snaps = networth?.snapshots || {};
            const keys = Object.keys(snaps).sort();
            if (!keys.length) return null;
            const lastKey = keys[keys.length - 1];
            const openingBank = snaps[lastKey]?.bank || 0;
            const currentBank = networth?.bank || 0;
            return {
              amount: Math.max(0, openingBank - currentBank),
              openingBank,
              currentBank,
              asOfKey: lastKey,
            };
          }

// Fixed items and SIPs are both budgeted amounts expected to come OUT of
// the same bank balance bankSpentThisMonth() already measures — together
// they're a breakdown of that drop, used to figure out "extra" (whatever
// of the drop neither accounts for — can go negative if less left the
// account than was planned, e.g. a bill or SIP hasn't auto-debited yet).
// But SIP is an investment, not an expense, so it's excluded from the
// final `total` — that figure is fixed + extra (equivalently, the bank
// drop minus SIP), which is what Health Score / Emergency Fund / FIRE
// should treat as "monthly expenses".
// Example: bank went 5L -> 2L (a 3L drop), 2L fixed + 50k SIP planned ->
// 50k extra/unplanned -> total EXPENSE = 2L + 50k = 2.5L, not 3L (the SIP
// portion doesn't count as spending).
export function totalMonthlyExpenses({ fixedExpenses, liqFunds, eqFunds, liquid, equity, networth }) {
            const fixed = fixedExpensesTotal(fixedExpenses);
            const sip = totalMonthlySip(liqFunds, eqFunds, liquid, equity);
            const planned = fixed + sip;
            const bankSpend = bankSpentThisMonth(networth);
            if (!bankSpend) {
              // No snapshot to diff against yet — the only real number we
              // have is the fixed budget; SIP stays excluded even here.
              return { fixed, sip, planned, bankSpend: null, extra: null, total: fixed };
            }
            const extra = bankSpend.amount - planned;
            return {
              fixed, sip, planned,
              bankSpend,
              extra,
              total: fixed + extra,
            };
          }

const pad2 = (n) => String(n).padStart(2, "0");
const monthKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

function prevMonthKey(key) {
            const [y, m] = key.split("-").map(Number);
            return monthKeyOf(new Date(y, m - 2, 1));
          }

function lastNMonthKeys(n) {
            const now = new Date();
            const keys = [];
            for (let i = n - 1; i >= 0; i--) keys.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
            return keys;
          }

// Indian FY: April -> March. yearsBack 0 = current (in-progress) FY,
// 1 = the FY immediately before that (a full, closed 12-month span).
function fyMonthKeys(yearsBack) {
            const now = new Date();
            const fyStartYear = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - yearsBack;
            const keys = [];
            for (let i = 0; i < 12; i++) {
              const d = new Date(fyStartYear, 3 + i, 1);
              if (yearsBack === 0 && d > now) break;
              keys.push(monthKeyOf(d));
            }
            return keys;
          }

export const EXPENSE_PERIODS = [
            { key: "month", label: "This Month" },
            { key: "3m", label: "Quarter" },
            { key: "6m", label: "6 Months" },
            { key: "12m", label: "12 Months" },
            { key: "fy", label: "Current FY" },
            { key: "lastfy", label: "Last FY" },
          ];

export function resolvePeriodKeys(periodKey) {
            switch (periodKey) {
              case "3m": return lastNMonthKeys(3);
              case "6m": return lastNMonthKeys(6);
              case "12m": return lastNMonthKeys(12);
              case "fy": return fyMonthKeys(0);
              case "lastfy": return fyMonthKeys(1);
              default: return lastNMonthKeys(1);
            }
          }

// Per-month expense breakdown across a range of "YYYY-MM" keys. The
// in-progress current month reuses bankSpentThisMonth()'s live-bank-vs-
// last-snapshot logic; completed months instead diff two saved snapshots
// (the month's own snapshot vs the one before it). Fixed and SIP totals
// aren't historized anywhere in the app, so today's amounts are applied
// retroactively to every month — a deliberate simplification, not a bug:
// only the bank-driven "extra" figure reflects genuine month-to-month
// variation. A month with no snapshot pair to diff comes back with
// bankDrop/extra/total all null rather than a guessed value.
export function monthlyExpenseSeries(periodKeys, { fixedExpenses, liqFunds, eqFunds, liquid, equity, networth }) {
            const snaps = networth?.snapshots || {};
            const fixed = fixedExpensesTotal(fixedExpenses);
            const sip = totalMonthlySip(liqFunds, eqFunds, liquid, equity);
            const planned = fixed + sip;
            const nowKey = monthKeyOf(new Date());

            return periodKeys.map(key => {
              let bankDrop = null;
              if (key === nowKey) {
                const bs = bankSpentThisMonth(networth);
                if (bs) bankDrop = bs.amount;
              } else {
                const prevKey = prevMonthKey(key);
                if (snaps[key] && snaps[prevKey]) {
                  bankDrop = Math.max(0, (snaps[prevKey].bank || 0) - (snaps[key].bank || 0));
                }
              }
              if (bankDrop === null) return { key, fixed, sip, planned, bankDrop: null, extra: null, total: null };
              const extra = bankDrop - planned;
              return { key, fixed, sip, planned, bankDrop, extra, total: fixed + extra };
            });
          }

// Averages each category only over months that actually have data (not the
// full period length) so a handful of missing snapshots don't silently
// drag the average down — monthsWithData is surfaced so the caller can be
// upfront about how much of the period is actually backed by real numbers.
export function averageExpenseBreakdown(series) {
            const valid = series.filter(m => m.bankDrop !== null);
            const n = valid.length;
            return {
              monthsWithData: n,
              totalMonths: series.length,
              avgFixed: n ? valid.reduce((s, m) => s + m.fixed, 0) / n : 0,
              avgExtra: n ? valid.reduce((s, m) => s + m.extra, 0) / n : 0,
              avgSip: n ? valid.reduce((s, m) => s + m.sip, 0) / n : 0,
            };
          }
