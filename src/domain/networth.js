import { NW_FIELDS } from "../core/constants.js";

export function mfTotalValue(liqFunds, eqFunds, liquid, equity) {
            const liq = liqFunds.reduce(
              (s, f) => s + (liquid[f.id].value || 0),
              0,
            );
            const eq = eqFunds.reduce(
              (s, f) => s + (equity[f.id].shown || 0),
              0,
            );
            return liq + eq;
          }

// MF Value as of a given "YYYY-MM" snapshot month — the net after-expense
// contribution (sip/lump minus redemptions) across all funds from
// transactions dated on or before the end of that month. This is what a
// Monthly History snapshot's MF Value should always reflect, whether the
// snapshot is being created for the first time or edited later.
export function mfValueAsOf(monthKey, liqFunds, eqFunds, transactions) {
            const [y, m] = monthKey.split("-").map(Number);
            const cutoff = new Date(y, m, 1).toISOString().slice(0, 10);
            const netAE = {};
            (transactions || []).forEach(t => {
              if (!t.date || t.date >= cutoff) return;
              const ae = Number(t.afterExpense ?? t.invested) || 0;
              const signed = t.type === "redemption" ? -ae : ae;
              netAE[t.fundId] = (netAE[t.fundId] || 0) + signed;
            });
            return [...liqFunds, ...eqFunds].reduce(
              (sum, f) => sum + Math.max(0, netAE[f.id] || 0), 0,
            );
          }

export function mfUnrealizedGain(liqFunds, eqFunds, liquid, equity) {
            let total = 0;
            liqFunds.forEach(f => {
              const s = liquid[f.id]; if (!s) return;
              const cv = s.currentValue || 0;
              if (cv > 0) total += cv - (s.value || 0);
            });
            eqFunds.forEach(f => {
              const s = equity[f.id]; if (!s) return;
              const cv = s.currentValue || 0;
              if (cv > 0) total += cv - (s.shown || 0);
            });
            return total;
          }

export function totalLiabilities(liabilities) {
            return (liabilities || []).reduce((s, l) => s + (Number(l.balance) || 0), 0);
          }

export function nwTotal(networth, liqFunds, eqFunds, liquid, equity, liabilities) {
            const other = NW_FIELDS.filter((f) => f.id !== "mfProfit").reduce(
              (s, f) => s + (networth[f.id] || 0),
              0,
            );
            return mfTotalValue(liqFunds, eqFunds, liquid, equity) + mfUnrealizedGain(liqFunds, eqFunds, liquid, equity) + other - totalLiabilities(liabilities);
          }

// Average monthly compounding rate across consecutive snapshot pairs —
// shared by the Projections cards' forward estimate and any other feature
// that needs "what rate has this net worth actually been growing at".
export function avgMonthlyGrowthRate(sortedSnaps) {
            let totalRate = 0, count = 0;
            for (let i = 1; i < sortedSnaps.length; i++) {
              const prev = sortedSnaps[i - 1], curr = sortedSnaps[i];
              if (prev.total > 0) {
                const [py, pm] = prev.key.split("-").map(Number);
                const [cy, cm] = curr.key.split("-").map(Number);
                const months = (cy - py) * 12 + (cm - pm);
                if (months > 0) {
                  totalRate += Math.pow(curr.total / prev.total, 1 / months) - 1;
                  count++;
                }
              }
            }
            return count > 0 ? totalRate / count : 0;
          }

export function buildCurrentSnapshot(networth, liqFunds, eqFunds, liquid, equity, liabilities) {
            const cur = { mf: mfTotalValue(liqFunds, eqFunds, liquid, equity), total: nwTotal(networth, liqFunds, eqFunds, liquid, equity, liabilities) };
            NW_FIELDS.forEach((f) => { cur[f.id] = networth[f.id] || 0; });
            cur.mfProfit = mfUnrealizedGain(liqFunds, eqFunds, liquid, equity);
            cur.liabilities = totalLiabilities(liabilities);
            return cur;
          }
