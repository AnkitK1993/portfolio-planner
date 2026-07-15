import { EQ_FUNDS, LIQ_FUNDS, state } from "../core/state.js";
import { NW_FIELDS } from "../core/constants.js";

export function mfTotalValue() {
            const liq = LIQ_FUNDS.reduce(
              (s, f) => s + (state.liquid[f.id].value || 0),
              0,
            );
            const eq = EQ_FUNDS.reduce(
              (s, f) => s + (state.equity[f.id].shown || 0),
              0,
            );
            return liq + eq;
          }

// MF Value as of a given "YYYY-MM" snapshot month — the net after-expense
// contribution (sip/lump minus redemptions) across all funds from
// transactions dated on or before the end of that month. This is what a
// Monthly History snapshot's MF Value should always reflect, whether the
// snapshot is being created for the first time or edited later.
export function mfValueAsOf(monthKey) {
            const [y, m] = monthKey.split("-").map(Number);
            const cutoff = new Date(y, m, 1).toISOString().slice(0, 10);
            const netAE = {};
            (state.transactions || []).forEach(t => {
              if (!t.date || t.date >= cutoff) return;
              const ae = Number(t.afterExpense ?? t.invested) || 0;
              const signed = t.type === "redemption" ? -ae : ae;
              netAE[t.fundId] = (netAE[t.fundId] || 0) + signed;
            });
            return [...LIQ_FUNDS, ...EQ_FUNDS].reduce(
              (sum, f) => sum + Math.max(0, netAE[f.id] || 0), 0,
            );
          }

export function mfUnrealizedGain() {
            let total = 0;
            LIQ_FUNDS.forEach(f => {
              const s = state.liquid[f.id]; if (!s) return;
              const cv = s.currentValue || 0;
              if (cv > 0) total += cv - (s.value || 0);
            });
            EQ_FUNDS.forEach(f => {
              const s = state.equity[f.id]; if (!s) return;
              const cv = s.currentValue || 0;
              if (cv > 0) total += cv - (s.shown || 0);
            });
            return total;
          }

export function nwTotal() {
            const other = NW_FIELDS.filter((f) => f.id !== "mfProfit").reduce(
              (s, f) => s + (state.networth[f.id] || 0),
              0,
            );
            return mfTotalValue() + mfUnrealizedGain() + other;
          }

export function buildCurrentSnapshot() {
            const cur = { mf: mfTotalValue(), total: nwTotal() };
            NW_FIELDS.forEach((f) => { cur[f.id] = state.networth[f.id] || 0; });
            cur.mfProfit = mfUnrealizedGain();
            return cur;
          }
