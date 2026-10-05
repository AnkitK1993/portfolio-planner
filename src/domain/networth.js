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

// MF Value as of a given date: the net after-expense contribution
// (sip/lump minus redemptions) per fund from transactions up to then.
// Accepts a full "YYYY-MM-DD" date (inclusive) or a "YYYY-MM" month
// (through the end of that month).
export function mfValueAsOf(asOf, liqFunds, eqFunds, transactions) {
            let cutoff;
            if (asOf.length > 7) {
              const d = new Date(asOf + "T00:00:00");
              d.setDate(d.getDate() + 1);
              cutoff = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
            } else {
              const [y, m] = asOf.split("-").map(Number);
              cutoff = new Date(y, m, 1).toISOString().slice(0, 10);
            }
            const netAE = {};
            (transactions || []).forEach(t => {
              if (!t.date || t.date >= cutoff) return;
              const ae = Number(t.afterExpense ?? t.invested) || 0;
              const signed = t.type === "redemption" ? -ae : t.type === "dividend" ? 0 : ae;
              netAE[t.fundId] = (netAE[t.fundId] || 0) + signed;
            });
            return [...liqFunds, ...eqFunds].reduce(
              (sum, f) => sum + Math.max(0, netAE[f.id] || 0), 0,
            );
          }

// Unrealized gain as it stood on a past date: for each fund, the gain
// recorded by the latest "Add Current Value" entry on or before then
// (0 if none had been logged yet).
export function mfProfitAsOf(asOf, liqFunds, eqFunds, returnsLog) {
            const latest = {};
            (returnsLog || []).forEach(l => {
              if (!l.date || l.date > asOf) return;
              if (!latest[l.fundId] || l.date >= latest[l.fundId].date) latest[l.fundId] = l;
            });
            return [...liqFunds, ...eqFunds].reduce((sum, f) => sum + (latest[f.id]?.profit || 0), 0);
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

export function nwTotal(networth, liqFunds, eqFunds, liquid, equity) {
            const other = NW_FIELDS.filter((f) => f.id !== "mfProfit").reduce(
              (s, f) => s + (networth[f.id] || 0),
              0,
            );
            return mfTotalValue(liqFunds, eqFunds, liquid, equity) + mfUnrealizedGain(liqFunds, eqFunds, liquid, equity) + other;
          }

// Average monthly compounding rate across consecutive snapshot pairs, for
// whatever figure `getter` pulls off each snapshot — shared by the
// Projections cards' forward estimate (via avgMonthlyGrowthRate, keyed to
// .total) and the Per-Asset Trends card (keyed to each individual asset
// field) so both use the exact same compounding math.
export function avgMonthlyGrowthRateBy(sortedSnaps, getter) {
            let totalRate = 0, count = 0;
            for (let i = 1; i < sortedSnaps.length; i++) {
              const prev = getter(sortedSnaps[i - 1]), curr = getter(sortedSnaps[i]);
              if (prev > 0) {
                const [py, pm] = sortedSnaps[i - 1].key.split("-").map(Number);
                const [cy, cm] = sortedSnaps[i].key.split("-").map(Number);
                const months = (cy - py) * 12 + (cm - pm);
                if (months > 0) {
                  totalRate += Math.pow(curr / prev, 1 / months) - 1;
                  count++;
                }
              }
            }
            return count > 0 ? totalRate / count : 0;
          }

export function avgMonthlyGrowthRate(sortedSnaps) {
            return avgMonthlyGrowthRateBy(sortedSnaps, (s) => s.total);
          }

// The snapshot in effect `monthsBack` months ago — i.e. the most recent
// snapshot dated at or before that target month, not necessarily an exact
// key match (so a gap in snapshot cadence doesn't just read as "no data").
// monthsBack: "all" for the earliest snapshot on record instead of a
// relative offset. sortedSnaps must be ascending by key.
export function snapshotMonthsAgo(sortedSnaps, monthsBack) {
            if (!sortedSnaps.length) return null;
            if (monthsBack === "all") return sortedSnaps[0];
            const now = new Date();
            const target = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
            const targetKey = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
            let match = null;
            for (const s of sortedSnaps) {
              if (s.key <= targetKey) match = s; else break;
            }
            return match;
          }

// ₹ and % change from a past value to a current one — null when there's
// no past snapshot to compare against, so callers can render "—" instead
// of a misleading 0% for genuinely missing history.
export function changeFrom(pastVal, currentVal) {
            if (pastVal == null) return null;
            const delta = currentVal - pastVal;
            const pct = pastVal !== 0 ? (delta / Math.abs(pastVal)) * 100 : null;
            return { delta, pct };
          }

// Months to reach `target` from `current`, compounding at a fixed monthly
// rate — the same formula independently duplicated by Net Worth's next-
// milestone ETA (renderNwMilestone, features/networth/index.js) and
// Financial Goals' per-goal ETA (renderFireProgress, features/summary/
// index.js) before this extraction. This is the bare formula, not a
// validated API — callers are responsible for their own guards (target
// actually greater than current, rate actually positive, etc.) before
// calling it, same as both call sites already did beforehand.
export function monthsToReach(target, current, monthlyRate) {
            return Math.log(target / current) / Math.log(1 + monthlyRate);
          }

export function buildCurrentSnapshot(networth, liqFunds, eqFunds, liquid, equity) {
            const cur = { mf: mfTotalValue(liqFunds, eqFunds, liquid, equity), total: nwTotal(networth, liqFunds, eqFunds, liquid, equity) };
            NW_FIELDS.forEach((f) => { cur[f.id] = networth[f.id] || 0; });
            cur.mfProfit = mfUnrealizedGain(liqFunds, eqFunds, liquid, equity);
            return cur;
          }
