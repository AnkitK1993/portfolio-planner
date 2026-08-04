const pad2 = (n) => String(n).padStart(2, "0");
const monthKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

// A fixed, small category set rather than free-form tags — keeps the
// per-category breakdown meaningful without needing a tag-management UI.
// "other" is the fallback for legacy items saved before this existed
// (normalizeExpenseCategory below), not a dead/unreachable case.
export const EXPENSE_CATEGORIES = [
            { key: "rent", label: "Rent", color: "#4ade9c" },
            { key: "emi", label: "EMI", color: "#60a5fa" },
            { key: "utility", label: "Utility", color: "#fbbf24" },
            { key: "insurance", label: "Insurance", color: "#f472b6" },
            { key: "subscription", label: "Subscription", color: "#a78bfa" },
            { key: "other", label: "Other", color: "#94a3b8" },
          ];

export function normalizeExpenseCategory(key) {
            return EXPENSE_CATEGORIES.find(c => c.key === key) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
          }

// An expense with no startDate has always been active (legacy items, and
// the default for new ones). One with a startDate only counts from that
// month onward — lets a newly-added expense (e.g. a new EMI) skip being
// misapplied to months before it actually existed.
function expenseActiveInMonth(expense, monthKey) {
            return !expense.startDate || expense.startDate.slice(0, 7) <= monthKey;
          }

export function fixedExpensesTotal(fixedExpenses, monthKey = monthKeyOf(new Date())) {
            return (fixedExpenses || [])
              .filter(e => expenseActiveInMonth(e, monthKey))
              .reduce((s, e) => s + (Number(e.amount) || 0), 0);
          }

// Per-category totals for the Fixed items list — only categories that
// actually have a nonzero item show up, in EXPENSE_CATEGORIES' own order
// (not sorted by amount) so the breakdown reads the same way every time.
export function fixedExpensesByCategory(fixedExpenses, monthKey = monthKeyOf(new Date())) {
            const totals = {};
            (fixedExpenses || [])
              .filter(e => expenseActiveInMonth(e, monthKey))
              .forEach(e => {
                const cat = normalizeExpenseCategory(e.category).key;
                totals[cat] = (totals[cat] || 0) + (Number(e.amount) || 0);
              });
            return EXPENSE_CATEGORIES
              .map(c => ({ ...c, total: totals[c.key] || 0 }))
              .filter(c => c.total > 0);
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

// Actual money that moved into (sip/lump) or out of (redemption) any fund
// during a given "YYYY-MM" month, from real logged transactions — as
// opposed to totalMonthlySip()'s static, configured `sipAmt`. A month can
// genuinely invest more than that configured plan (a one-off top-up, an
// extra lump purchase); this is how totalMonthlyExpenses()/
// monthlyExpenseSeries() recognize that surplus as investment rather than
// unplanned bank spending.
function investedInMonth(transactions, monthKey) {
            return (transactions || []).reduce((sum, t) => {
              if (!t.date || t.date.slice(0, 7) !== monthKey) return sum;
              const ae = Number(t.afterExpense ?? t.invested) || 0;
              return sum + (t.type === "redemption" ? -ae : ae);
            }, 0);
          }

// Bank spend this month = this month's Initial bank balance minus the
// live Current bank balance, both entered on the Net Worth tab's Update
// Assets card. Initial is carried forward automatically to Current's
// value whenever a snapshot is saved (see takeSnapshot()), so it always
// reflects this tracking period's own opening figure rather than
// whatever the last snapshot happened to record.
// Clamped to 0 so a mid-month deposit (salary credit, etc.) never reads as
// negative spending. Returns null only when neither Initial nor Current
// has ever been entered (both still 0) — the "haven't started tracking
// yet" case.
export function bankSpentThisMonth(networth) {
            const openingBank = networth?.bankInitial || 0;
            const currentBank = networth?.bank || 0;
            if (!openingBank && !currentBank) return null;
            return {
              amount: Math.max(0, openingBank - currentBank),
              openingBank,
              currentBank,
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
//
// A month can also invest MORE than that configured SIP plan — a manual
// lump top-up, an extra purchase — visible as the Mutual Funds figure
// growing by more than the planned SIP amount. That excess genuinely left
// the bank for investing, not spending, so it's surfaced separately as
// `surplusInvestment` and folded into `planned` (not `extra`) — otherwise
// it would misreport as unplanned spend. Falls back to the configured
// `sip` figure whenever actual logged investing this month is less than
// that (e.g. no transactions logged yet, or the SIP hasn't auto-debited),
// leaving existing behavior unchanged in that case.
// `networth.expenses` is an optional direct entry (see Update Assets) for
// when Bank alone can't isolate genuine spend from investing/saving —
// e.g. income landing in the same account the same month as spending,
// which bankSpentThisMonth() has no way to net out. When set (>0), it
// replaces the bank-derived `total` outright; `extra` is recomputed as
// total-minus-fixed so the fixed+extra=total invariant the rest of the
// card relies on still holds. bankSpend is still returned so the
// breakdown/segment bar has something to show, even though it no longer
// drives the headline total.
export function totalMonthlyExpenses({ fixedExpenses, liqFunds, eqFunds, liquid, equity, networth, transactions }) {
            const fixed = fixedExpensesTotal(fixedExpenses);
            const sip = totalMonthlySip(liqFunds, eqFunds, liquid, equity);
            const investedThisMonth = investedInMonth(transactions, monthKeyOf(new Date()));
            const investedForPlanning = Math.max(sip, investedThisMonth);
            const surplusInvestment = investedForPlanning - sip;
            const planned = fixed + investedForPlanning;
            const bankSpend = bankSpentThisMonth(networth);
            const manualExpenses = Number(networth?.expenses) || 0;
            if (manualExpenses > 0) {
              return { fixed, sip, surplusInvestment, planned, bankSpend, extra: manualExpenses - fixed, total: manualExpenses, isManual: true };
            }
            if (!bankSpend) {
              // No snapshot to diff against yet — the only real number we
              // have is the fixed budget; SIP stays excluded even here.
              return { fixed, sip, surplusInvestment, planned, bankSpend: null, extra: null, total: fixed };
            }
            // Never show less than the fixed budget as "this month's
            // expenses" — that much is guaranteed regardless of what the
            // bank-drop signal currently says (e.g. right at the start of
            // a tracking period, before the drop has caught up to even
            // the known fixed costs). Once the drop genuinely exceeds
            // fixed+SIP, the real bank-derived figure takes over instead.
            // extra is recomputed as total-minus-fixed so the fixed+extra
            // =total invariant still holds, same convention as the
            // manual-entry case above — it reads 0, not negative,
            // whenever the floor is what's actually showing.
            const total = Math.max(fixed, fixed + (bankSpend.amount - planned));
            const extra = total - fixed;
            return {
              fixed, sip, surplusInvestment, planned,
              bankSpend,
              extra,
              total,
            };
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
// in-progress current month reuses bankSpentThisMonth()'s live Initial-
// vs-Current logic; completed months instead read that same month's own
// snapshot — bankInitial and bank were both frozen into it at
// takeSnapshot() time, so each month is self-contained and no longer
// needs the month before it to compute a drop. Fixed item *amounts*
// aren't historized anywhere in the app, so today's amount is still what
// applies to every past month an item was active for — but which items
// count in a given month now respects each one's own startDate (see
// expenseActiveInMonth), so an expense added this month no longer bleeds
// into earlier months it didn't exist in. SIP has no such concept and
// stays fully retroactive.
//
// A month can also carry a manually-entered `expenses` figure (current
// month: networth.expenses; past months: that month's own snapshot) —
// same reasoning as totalMonthlyExpenses()'s manualExpenses: it wins
// outright over the bank-diffed total, and critically it's the only way
// a month with no saved snapshot at all gets a real total instead of
// null. Without a manual figure and no snapshot to read, bankDrop/extra/
// total all come back null rather than a guessed value.
//
// Like totalMonthlyExpenses(), each month's actual logged investing (from
// transactions dated in that month) is recognized as investment rather
// than unplanned spend whenever it exceeds today's configured SIP figure
// — see investedInMonth() above.
export function monthlyExpenseSeries(periodKeys, { fixedExpenses, liqFunds, eqFunds, liquid, equity, networth, transactions }) {
            const snaps = networth?.snapshots || {};
            const sip = totalMonthlySip(liqFunds, eqFunds, liquid, equity);
            const nowKey = monthKeyOf(new Date());

            return periodKeys.map(key => {
              const fixed = fixedExpensesTotal(fixedExpenses, key);
              const investedForPlanning = Math.max(sip, investedInMonth(transactions, key));
              const surplusInvestment = investedForPlanning - sip;
              const planned = fixed + investedForPlanning;

              const manualExpenses = Number(key === nowKey ? networth?.expenses : snaps[key]?.expenses) || 0;
              if (manualExpenses > 0) {
                return { key, fixed, sip, surplusInvestment, planned, bankDrop: null, extra: manualExpenses - fixed, total: manualExpenses, isManual: true };
              }

              let bankDrop = null;
              if (key === nowKey) {
                const bs = bankSpentThisMonth(networth);
                if (bs) bankDrop = bs.amount;
              } else if (snaps[key]) {
                const snapInitial = snaps[key].bankInitial != null ? snaps[key].bankInitial : (snaps[key].bank || 0);
                bankDrop = Math.max(0, snapInitial - (snaps[key].bank || 0));
              }
              if (bankDrop === null) return { key, fixed, sip, surplusInvestment, planned, bankDrop: null, extra: null, total: null };
              // Same floor as totalMonthlyExpenses() — never below fixed.
              const total = Math.max(fixed, fixed + (bankDrop - planned));
              const extra = total - fixed;
              return { key, fixed, sip, surplusInvestment, planned, bankDrop, extra, total };
            });
          }

// Averages each category only over months that actually have data (not the
// full period length) so a handful of missing snapshots don't silently
// drag the average down — monthsWithData is surfaced so the caller can be
// upfront about how much of the period is actually backed by real numbers.
// Filters on `total` (not `bankDrop`) so manually-entered months — which
// have a real total but no bankDrop, see monthlyExpenseSeries() — still
// count as data.
export function averageExpenseBreakdown(series) {
            const valid = series.filter(m => m.total !== null);
            const n = valid.length;
            return {
              monthsWithData: n,
              totalMonths: series.length,
              avgFixed: n ? valid.reduce((s, m) => s + m.fixed, 0) / n : 0,
              avgExtra: n ? valid.reduce((s, m) => s + m.extra, 0) / n : 0,
              avgSip: n ? valid.reduce((s, m) => s + m.sip, 0) / n : 0,
              avgSurplus: n ? valid.reduce((s, m) => s + (m.surplusInvestment || 0), 0) / n : 0,
            };
          }

// Income isn't re-entered every month (see Update Assets — it's a
// "whatever was last set" figure, only changed when it actually changes,
// like a raise), so a month with no snapshot of its own carries forward
// the most recent prior snapshot's Income rather than reading as a gap.
// Only genuinely returns null for months before any snapshot existed at
// all. The in-progress current month uses the live Income value instead.
export function monthlyIncomeSeries(periodKeys, networth) {
            const snaps = networth?.snapshots || {};
            const sortedKeys = Object.keys(snaps).sort();
            const nowKey = monthKeyOf(new Date());
            return periodKeys.map(key => {
              if (key === nowKey) return { key, income: networth?.income || 0 };
              let income = null;
              for (const k of sortedKeys) {
                if (k <= key) income = snaps[k]?.income ?? income;
                else break;
              }
              return { key, income };
            });
          }

export function averageIncome(series) {
            const valid = series.filter(m => m.income !== null);
            const n = valid.length;
            return { monthsWithData: n, avgIncome: n ? valid.reduce((s, m) => s + m.income, 0) / n : 0 };
          }
