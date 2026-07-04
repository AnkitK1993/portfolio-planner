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
