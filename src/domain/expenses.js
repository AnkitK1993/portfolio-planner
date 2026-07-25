import { state } from "../core/state.js";

export function fixedExpensesTotal() {
            return (state.surplus?.fixedExpenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
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

export function totalMonthlyExpenses() {
            const fixed = fixedExpensesTotal();
            const bankSpend = bankSpentThisMonth();
            return {
              fixed,
              bankSpend,
              total: fixed + (bankSpend?.amount || 0),
            };
          }
