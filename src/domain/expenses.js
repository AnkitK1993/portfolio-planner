import { EQ_FUNDS, LIQ_FUNDS, state } from "../core/state.js";

export function fixedExpensesTotal() {
            return (state.surplus?.fixedExpenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
          }

// Total of every fund's monthly SIP amount (liquid + equity — the Manage
// SIPs modal allows both). SIPs auto-debit from the same bank account
// bankSpentThisMonth() diffs, so like fixed expenses they're a planned
// chunk of that drop, not a separate outflow layered on top of it.
export function totalMonthlySip() {
            return [...LIQ_FUNDS, ...EQ_FUNDS].reduce((s, f) => {
              const isLiq = LIQ_FUNDS.some(x => x.id === f.id);
              const fs = isLiq ? state.liquid[f.id] : state.equity[f.id];
              return s + (fs?.sipAmt || 0);
            }, 0);
          }

// Bank spend this month = the most recent monthly snapshot's Bank balance
// (the month's opening figure) minus the live Bank value on the Net Worth
// tab's Enter Values section (today's balance) — reuses that field rather
// than tracking a second, easily-drifting copy of "current bank balance".
// Clamped to 0 so a mid-month deposit (salary credit, etc.) never reads as
// negative spending.
export function bankSpentThisMonth() {
            const snaps = state.networth?.snapshots || {};
            const keys = Object.keys(snaps).sort();
            if (!keys.length) return null;
            const lastKey = keys[keys.length - 1];
            const openingBank = snaps[lastKey]?.bank || 0;
            const currentBank = state.networth?.bank || 0;
            return {
              amount: Math.max(0, openingBank - currentBank),
              openingBank,
              currentBank,
              asOfKey: lastKey,
            };
          }

// Fixed items and SIPs are both budgeted amounts expected to come OUT of
// the same bank balance bankSpentThisMonth() already measures — together
// they're a breakdown of that drop, not a separate spend on top of it. So
// the real total spent this month is the bank drop itself; "extra" is
// whatever of that drop isn't accounted for by fixed + SIP (can go
// negative if less left the account than was planned — e.g. a bill or SIP
// hasn't auto-debited yet).
// Example: bank went 5L -> 2L (a 3L drop), 2L of fixed expenses were
// planned -> 1L of unplanned/extra spend, 3L total, not 5L.
export function totalMonthlyExpenses() {
            const fixed = fixedExpensesTotal();
            const sip = totalMonthlySip();
            const planned = fixed + sip;
            const bankSpend = bankSpentThisMonth();
            if (!bankSpend) {
              // No snapshot to diff against yet — the only real number we
              // have is the planned total, so use that as the estimate.
              return { fixed, sip, planned, bankSpend: null, extra: null, total: planned };
            }
            return {
              fixed, sip, planned,
              bankSpend,
              extra: bankSpend.amount - planned,
              total: bankSpend.amount,
            };
          }
