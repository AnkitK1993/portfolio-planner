import { state } from "../core/state.js";

export function xirrCalc(cashflows) {
            if (!cashflows || cashflows.length < 2) return null;
            let hasPos = false, hasNeg = false, t0 = Infinity;
            for (const c of cashflows) {
              if (c.amount > 0) hasPos = true;
              if (c.amount < 0) hasNeg = true;
              if (c.date < t0) t0 = c.date;
            }
            if (!hasPos || !hasNeg) return null;
            const yrs = cashflows.map(c => (c.date - t0) / (365.25 * 24 * 3600 * 1000));

            // f(r) and df(r) share the same Math.pow(1+r, yrs[i]) term, and were
            // previously computed via two separate array reduces per Newton
            // iteration (each with its own Math.pow call) — merged into one
            // pass that computes both values together and derives the
            // derivative's pow term by multiplying instead of a second pow().
            let r = 0.1;
            for (let i = 0; i < 100; i++) {
              let fv = 0, dv = 0;
              for (let j = 0; j < cashflows.length; j++) {
                const pw = Math.pow(1 + r, yrs[j]);
                fv += cashflows[j].amount / pw;
                dv -= cashflows[j].amount * yrs[j] / (pw * (1 + r));
              }
              if (Math.abs(dv) < 1e-10) break;
              const nr = r - fv / dv;
              if (!isFinite(nr) || Math.abs(nr) > 100) return null;
              if (Math.abs(nr - r) < 1e-7) return nr;
              r = nr;
            }
            return Math.abs(r) < 100 ? r : null;
          }

export const _fundXirrCache = new Map();

export function fundXirr(fid, isLiq) {
            const s = isLiq ? state.liquid[fid] : state.equity[fid];
            const curVal = isLiq
              ? (s.currentValue || s.value || 0)
              : (s.currentValue || s.shown || 0);
            if (!curVal) return null;
            const txns = (state.transactions || []).filter(t => t.fundId === fid && t.date && Number(t.invested) > 0);
            if (!txns.length) return null;

            let investedSum = 0, minDate = Infinity, maxDate = -Infinity;
            for (const t of txns) {
              investedSum += Number(t.invested);
              const d = new Date(t.date).getTime();
              if (d < minDate) minDate = d;
              if (d > maxDate) maxDate = d;
            }
            const cacheKey = txns.length + "|" + investedSum.toFixed(2) + "|" + curVal.toFixed(2) + "|" + minDate + "|" + maxDate;
            const cached = _fundXirrCache.get(fid);
            if (cached && cached.key === cacheKey) return cached.val;

            const cfs = txns.map(t => ({ amount: -Number(t.invested), date: new Date(t.date).getTime() }));
            cfs.push({ amount: curVal, date: Date.now() });
            const val = xirrCalc(cfs);
            _fundXirrCache.set(fid, { key: cacheKey, val });
            return val;
          }

export let _xirrCache = { key: null, val: null };

export function cachedPortfolioXirr(allTxns, totalVal) {
            const cacheKey = allTxns.length + "|" + totalVal.toFixed(0) +
              "|" + (allTxns[0]?.date || "") + "|" + (allTxns[allTxns.length - 1]?.date || "");
            if (_xirrCache.key === cacheKey) return _xirrCache.val;
            const cfs = allTxns.map(t => ({ amount: -Number(t.invested), date: new Date(t.date).getTime() }));
            cfs.push({ amount: totalVal, date: Date.now() });
            _xirrCache = { key: cacheKey, val: xirrCalc(cfs) };
            return _xirrCache.val;
          }
