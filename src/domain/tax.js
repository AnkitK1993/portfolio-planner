import { EQ_FUNDS, LIQ_FUNDS, state } from "../core/state.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LT_HOLDING_DAYS = 365; // ">12 months" approximated in days

// International/overseas equity funds lost equity tax treatment under the
// Finance Act 2023 — taxed like debt funds (slab rate, no LTCG concession)
// regardless of holding period, even though the category is under EQ_FUNDS.
const DEBT_TAXED_EQ_CATEGORIES = new Set(["International"]);

export const LTCG_EXEMPTION = 125000;
export const LTCG_RATE = 0.125;
export const STCG_RATE = 0.20;

// FIFO lot walk: every SIP/lump/STP transaction is an inflow "lot" dated at
// purchase; every redemption consumes the oldest remaining lot(s) first
// (the legal ordering for MF units in India). What's left after walking the
// full transaction history is what's still held today — bucketed here into
// long-term (>=365 days old) vs short-term, as fractions of the currently
// held basis, so the caller can apportion today's unrealized gain between
// the two without needing an independent, possibly-drifted basis figure.
function fifoLtStFractions(fundId) {
            const txns = (state.transactions || [])
              .filter(t => t.fundId === fundId && t.date)
              .sort((a, b) => a.date.localeCompare(b.date));
            const lots = [];
            txns.forEach(t => {
              const ae = Number(t.afterExpense ?? t.invested) || 0;
              if (ae <= 0) return;
              if (t.type === "redemption") {
                let remaining = ae;
                while (remaining > 0 && lots.length) {
                  const consume = Math.min(lots[0].amount, remaining);
                  lots[0].amount -= consume;
                  remaining -= consume;
                  if (lots[0].amount <= 0.01) lots.shift();
                }
              } else {
                lots.push({ date: t.date, amount: ae });
              }
            });
            const now = Date.now();
            let lt = 0, st = 0;
            lots.forEach(l => {
              const ageDays = (now - new Date(l.date).getTime()) / MS_PER_DAY;
              if (ageDays >= LT_HOLDING_DAYS) lt += l.amount; else st += l.amount;
            });
            const total = lt + st;
            // No transaction history for this fund (e.g. a legacy holding
            // entered as a manual value/paid figure) — holding period is
            // genuinely unknown, so return null rather than guessing either
            // direction. Silently assuming long-term would understate tax
            // for a recently-bought fund; assuming short-term would
            // overstate it for a years-old one.
            return total > 0 ? { ltFrac: lt / total, stFrac: st / total } : null;
          }

// Rough estimate of capital-gains tax if every current holding were
// redeemed today. Deliberately simplified vs. real tax law:
//  - Losses are excluded rather than netted against gains (real inter-fund/
//    inter-category loss offset + carryforward rules aren't modeled).
//  - The pre-April-2023 debt-fund LTCG grandfathering exception isn't
//    modeled — all liquid/debt holdings are taxed at slab rate.
//  - Debt/liquid + International-equity gains use a single user-supplied
//    slab rate rather than real progressive-slab computation.
// Meant as a directional number, not a filing figure.
export function estimateCapitalGainsTax() {
            const taxSlabPct = state.surplus?.taxSlabPct ?? 30;
            let ltGain = 0, stGain = 0, debtGain = 0;
            let excludedGain = 0, excludedFunds = 0;
            let hasAnyHolding = false;

            EQ_FUNDS.forEach(f => {
              const s = state.equity[f.id];
              if (!s) return;
              const basis = s.shown || 0;
              if (basis <= 0) return;
              hasAnyHolding = true;
              const cv = s.currentValue || basis;
              const gain = cv - basis;
              if (gain <= 0) return;
              if (DEBT_TAXED_EQ_CATEGORIES.has(s.category)) { debtGain += gain; return; }
              const fracs = fifoLtStFractions(f.id);
              if (!fracs) { excludedGain += gain; excludedFunds++; return; }
              ltGain += gain * fracs.ltFrac;
              stGain += gain * fracs.stFrac;
            });

            LIQ_FUNDS.forEach(f => {
              const s = state.liquid[f.id];
              if (!s) return;
              const basis = s.value || 0;
              if (basis <= 0) return;
              hasAnyHolding = true;
              const cv = s.currentValue || basis;
              const gain = cv - basis;
              if (gain > 0) debtGain += gain;
            });

            const ltcgTaxable = Math.max(0, ltGain - LTCG_EXEMPTION);
            const equityLtTax = ltcgTaxable * LTCG_RATE;
            const equityStTax = stGain * STCG_RATE;
            const debtTax = debtGain * (taxSlabPct / 100);

            return {
              hasAnyHolding,
              ltGain, stGain, debtGain,
              ltcgTaxable,
              equityLtTax, equityStTax, debtTax,
              totalTax: equityLtTax + equityStTax + debtTax,
              taxSlabPct,
              excludedGain, excludedFunds,
            };
          }
