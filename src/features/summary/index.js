import { EQ_CATEGORIES } from "../../core/constants.js";
import { EQ_FUNDS, LIQ_FUNDS, editMode, fundName, normalizeSnap, saveState, state } from "../../core/state.js";
import { UI } from "../../core/ui.js";
import { _animOnRender, _animRaf, animateNumber, animateWidth } from "../../core/animate.js";
import { avgMonthlyGrowthRate, nwTotal } from "../../domain/networth.js";
import { cachedPortfolioXirr, fundXirr, rollingPortfolioXirr } from "../../domain/xirr.js";
import { el } from "../../core/dom.js";
import { estimateCapitalGainsTax, LTCG_EXEMPTION } from "../../domain/tax.js";
import { fmt, fmtCompact, fmtMonth, pct } from "../../core/format.js";
import { totalMonthlyExpenses } from "../../domain/expenses.js";
import { renderAllocBars, renderCompositionDonut } from "../portfolio/allocation.js";
import { renderIdealAlloc } from "./rebalance.js";

export function renderSummaryExtras(eqCur, liqCur, totCur, eqTgt, liqTgt, totTgt, nowEqPct, tgtEqPct) {
            /* — Health Score (also renders the drift alert banner) — */
            renderHealthScore();

            /* — Expenses (fixed items + auto bank-spend) — */
            renderExpenses();

            /* — Financial Independence progress — */
            renderFireProgress();

            /* — Ideal Allocation card — */
            renderIdealAlloc();

            /* — Fund performance table — */
            renderFundTable();
            /* — XIRR + heatmap — */
            renderXirrAndHeatmap();
            /* — Allocation bars — */
            renderAllocBars();
            /* — Portfolio composition donut — */
            renderCompositionDonut();
            /* — Tax estimate — */
            renderTaxEstimate();
          }

function renderTaxEstimate() {
            const card = el("sumTaxCard");
            const body = el("sumTaxBody");
            if (!card || !body) return;

            const t = estimateCapitalGainsTax();
            if (!t.hasAnyHolding) { card.style.display = "none"; return; }
            card.style.display = "";

            const row = (label, gainTxt, taxTxt, sub) => `
              <div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--line);">
                <div>
                  <div style="font-size:11.5px;color:var(--txt);">${label}</div>
                  ${sub ? `<div style="font-size:9px;color:var(--dim);margin-top:1px;">${sub}</div>` : ""}
                </div>
                <div style="font-family:'Roboto Mono',monospace;font-size:11px;color:var(--dim);text-align:right;white-space:nowrap;">${gainTxt}</div>
                <div style="font-family:'Roboto Mono',monospace;font-size:11px;font-weight:700;color:var(--coral);text-align:right;white-space:nowrap;min-width:70px;">${taxTxt}</div>
              </div>`;

            body.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.7px;color:var(--dim);">Estimated Tax</span>
                <span style="font-family:'Roboto Mono',monospace;font-size:22px;font-weight:700;color:var(--coral);">${fmt(t.totalTax)}</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;padding-bottom:4px;">
                <span></span>
                <span style="font-size:9px;color:var(--dim);text-align:right;">Gain</span>
                <span style="font-size:9px;color:var(--dim);text-align:right;min-width:70px;">Tax</span>
              </div>
              ${row("Equity LTCG", fmt(t.ltGain), fmt(t.equityLtTax), `Held 12+ mo · ${fmt(LTCG_EXEMPTION)} exempt/yr · 12.5% above that`)}
              ${row("Equity STCG", fmt(t.stGain), fmt(t.equityStTax), "Held under 12 mo · flat 20%")}
              ${row("Debt / Liquid / International", fmt(t.debtGain), fmt(t.debtTax), "Taxed at your income slab rate, any holding period")}
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);">
                <span style="font-size:11px;color:var(--txt)">Post-tax corpus if redeemed today</span>
                <span style="font-family:'Roboto Mono',monospace;font-size:13px;font-weight:700;color:var(--mint)">${fmt(t.grossValue)} → ${fmt(t.netAfterTax)}</span>
              </div>
              ${t.ltcgHeadroom > 0 ? `<div style="font-size:10.5px;color:var(--mint);margin-top:10px;line-height:1.5;">
                💡 You have <b>${fmt(t.ltcgHeadroom)}</b> of unused LTCG exemption this FY — realize up to that much more long-term equity gain tax-free (assuming you haven't booked LTCG elsewhere this year).
              </div>` : ""}
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap;">
                <span style="font-size:10px;color:var(--dim)">Your income tax slab ${editMode ? "" : "(tap Edit to change)"}</span>
                <div style="display:flex;align-items:center;gap:4px;">
                  <input type="number" id="sumTaxSlabInp" min="0" max="42.74" step="1" value="${t.taxSlabPct}" ${editMode ? "" : "readonly"}
                    style="background:var(--input-bg,rgba(255,255,255,0.06));border:1px solid var(--line);border-radius:5px;color:${editMode ? "var(--txt)" : "var(--dim)"};
                           font-family:'Roboto Mono',monospace;font-size:11px;text-align:right;padding:4px 7px;width:60px;${editMode ? "" : "cursor:default;"}"/>
                  <span style="font-size:11px;color:var(--dim)">%</span>
                </div>
              </div>
              ${t.excludedFunds > 0 ? `<div style="font-size:9.5px;color:var(--amber);margin-top:8px;">⚠ ${fmt(t.excludedGain)} gain across ${t.excludedFunds} fund${t.excludedFunds !== 1 ? "s" : ""} excluded — no transaction history to determine holding period.</div>` : ""}`;

            const slabInp = el("sumTaxSlabInp");
            if (slabInp) {
              slabInp.addEventListener("change", e => {
                if (!editMode) { renderTaxEstimate(); return; }
                if (!state.surplus) state.surplus = {};
                state.surplus.taxSlabPct = Math.max(0, parseFloat(e.target.value) || 0);
                saveState();
                renderTaxEstimate();
              });
            }
          }

const FUND_TABLE_COLS = [
  { key: "name", label: "Fund" },
  { key: "invested", label: "Invested" },
  { key: "returns", label: "Returns" },
  { key: "returnsPct", label: "Ret %" },
  { key: "xirr", label: "XIRR" },
];

let fundTableSort = { col: "invested", dir: "desc" };

const signedCompact = (n) => (n >= 0 ? "+" : "") + fmtCompact(n);

/* Shared by the Portfolio XIRR card and the Fund Performance table's total
   row so both always agree — cachedPortfolioXirr memoizes on a fingerprint
   of the inputs, so calling it from both call sites is effectively free. */
function portfolioXirrSummary() {
            const allTxns = (state.transactions || []).filter(t => t.date && Number(t.afterExpense ?? t.invested) > 0);
            const totalVal = LIQ_FUNDS.reduce((s, f) => s + (state.liquid[f.id]?.currentValue || state.liquid[f.id]?.value || 0), 0) +
                             EQ_FUNDS.reduce((s, f) => s + (state.equity[f.id]?.currentValue || state.equity[f.id]?.shown || 0), 0);
            if (!allTxns.length || totalVal <= 0) return null;
            return cachedPortfolioXirr(allTxns, totalVal);
          }

export function renderFundTable() {
            const wrap = el("sumFundTable");
            if (!wrap) return;

            const rows = [...LIQ_FUNDS.map(f => ({ f, isLiq: true })), ...EQ_FUNDS.map(f => ({ f, isLiq: false }))]
              .map(({ f, isLiq }) => {
                const s = isLiq ? state.liquid[f.id] : state.equity[f.id];
                const invested = s.paid || 0;
                const afterExp = isLiq ? (s.value || 0) : (s.shown || 0);
                const current = s.currentValue || afterExp;
                // Returns are measured against the after-expense amount
                // actually put to work, not the raw invested amount — and
                // left blank when there's no after-expense basis to measure
                // against, rather than showing a misleading 0%.
                const returns = afterExp > 0 ? current - afterExp : null;
                return {
                  name: fundName(f.id),
                  isLiq,
                  invested,
                  afterExp,
                  current,
                  returns,
                  returnsPct: afterExp > 0 ? pct(returns, afterExp) : null,
                  xirr: fundXirr(f.id, isLiq),
                };
              })
              .filter(r => r.invested > 0 || r.current > 0);

            if (!rows.length) {
              wrap.innerHTML = UI.emptyState("📊", "No fund data yet", "Add transactions and current values to see performance here.");
              return;
            }

            const dirMul = fundTableSort.dir === "asc" ? 1 : -1;
            rows.sort((a, b) => {
              if (fundTableSort.col === "name") return dirMul * a.name.localeCompare(b.name);
              const av = a[fundTableSort.col], bv = b[fundTableSort.col];
              const an = av == null ? -Infinity : av, bn = bv == null ? -Infinity : bv;
              return dirMul * (an - bn);
            });

            const headHtml = FUND_TABLE_COLS.map(c => {
              const active = fundTableSort.col === c.key;
              const arrow = active ? (fundTableSort.dir === "asc" ? " ▲" : " ▼") : "";
              return `<button type="button" class="fperf-th${c.key !== "name" ? " fperf-num" : ""}${active ? " active" : ""}" data-col="${c.key}">${c.label}${arrow}</button>`;
            }).join("");

            const rowsHtml = rows.map(r => {
              const retClass = r.returns == null ? "" : r.returns >= 0 ? "mint" : "coral";
              const retTxt = r.returns == null ? "—" : signedCompact(r.returns);
              const retPctTxt = r.returnsPct == null ? "—" : (r.returnsPct >= 0 ? "+" : "") + r.returnsPct.toFixed(2) + "%";
              const xirrTxt = r.xirr == null ? "—" : (r.xirr * 100 >= 0 ? "+" : "") + (r.xirr * 100).toFixed(2) + "%";
              const xirrClass = r.xirr == null ? "" : r.xirr >= 0 ? "mint" : "coral";
              return `<div class="fperf-row">
                <span class="fperf-name">${r.name}<span class="fp-tag ${r.isLiq ? "liq" : "eq"}">${r.isLiq ? "LIQ" : "EQ"}</span></span>
                <span class="fperf-num">${fmtCompact(r.invested)}</span>
                <span class="fperf-num"${retClass ? ` style="color:var(--${retClass})"` : ""}>${retTxt}</span>
                <span class="fperf-num"${retClass ? ` style="color:var(--${retClass})"` : ""}>${retPctTxt}</span>
                <span class="fperf-num"${xirrClass ? ` style="color:var(--${xirrClass})"` : ""}>${xirrTxt}</span>
              </div>`;
            }).join("");

            // Portfolio total row — folds in the same XIRR shown on the
            // Portfolio XIRR card above, so the two never disagree.
            let totalRowHtml = "";
            if (rows.length > 1) {
              const totalInvested = rows.reduce((s, r) => s + r.invested, 0);
              const totalAfterExp = rows.reduce((s, r) => s + (r.returns != null ? r.afterExp : 0), 0);
              const totalReturns = rows.reduce((s, r) => s + (r.returns || 0), 0);
              const totalReturnsPct = totalAfterExp > 0 ? pct(totalReturns, totalAfterExp) : null;
              const portfolioXirr = portfolioXirrSummary();
              const totRetClass = totalReturns >= 0 ? "mint" : "coral";
              const totXirrTxt = portfolioXirr == null ? "—" : (portfolioXirr * 100 >= 0 ? "+" : "") + (portfolioXirr * 100).toFixed(2) + "%";
              const totXirrClass = portfolioXirr == null ? "" : portfolioXirr >= 0 ? "mint" : "coral";
              totalRowHtml = `<div class="fperf-row fperf-total">
                <span class="fperf-name">Portfolio</span>
                <span class="fperf-num">${fmtCompact(totalInvested)}</span>
                <span class="fperf-num" style="color:var(--${totRetClass})">${signedCompact(totalReturns)}</span>
                <span class="fperf-num" style="color:var(--${totRetClass})">${totalReturnsPct == null ? "—" : (totalReturnsPct >= 0 ? "+" : "") + totalReturnsPct.toFixed(2) + "%"}</span>
                <span class="fperf-num"${totXirrClass ? ` style="color:var(--${totXirrClass})"` : ""}>${totXirrTxt}</span>
              </div>`;
            }

            wrap.innerHTML = `<div class="fperf-table">
              <div class="fperf-row fperf-head">${headHtml}</div>
              ${rowsHtml}
              ${totalRowHtml}
            </div>`;

            wrap.querySelectorAll(".fperf-th").forEach(btn => {
              btn.addEventListener("click", () => {
                const col = btn.dataset.col;
                if (fundTableSort.col === col) fundTableSort.dir = fundTableSort.dir === "asc" ? "desc" : "asc";
                else fundTableSort = { col, dir: col === "name" ? "asc" : "desc" };
                renderFundTable();
              });
            });
          }

export function renderHealthScore() {
            const card = el("sumHealthCard");
            const wrap = el("sumHealthScore");
            if (!wrap) return;

            // ── Dimension 1: Consistency (investment streak) ──
            const txnMonths = new Set((state.transactions || [])
              .filter(t => t.type !== "redemption" && t.date)
              .map(t => t.date.slice(0, 7)));
            const now = new Date();
            let streak = 0;
            for (let i = 0; i < 120; i++) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
              if (txnMonths.has(k)) streak++;
              else if (i > 0) break;
            }
            let cScore = 0, cNote = "No recent investments";
            if (streak >= 24) { cScore = 25; cNote = streak + " month streak"; }
            else if (streak >= 12) { cScore = 20; cNote = streak + " month streak"; }
            else if (streak >= 6)  { cScore = 15; cNote = streak + " month streak"; }
            else if (streak >= 3)  { cScore = 10; cNote = streak + " month streak"; }
            else if (streak >= 1)  { cScore = 5;  cNote = streak === 1 ? "1 month streak" : streak + " month streak"; }

            // ── Dimension 2: Allocation drift vs ideal ──
            let aScore = 15, aNote = "Set fund categories to measure";
            const activeCats = [...new Set(EQ_FUNDS.map(f => state.equity[f.id]?.category).filter(c => c && c !== ""))];
            const wts = {};
            const DEF_WTS = { "Large Cap": 45, "Flexi Cap": 33, "Mid Cap": 22 };
            EQ_CATEGORIES.forEach(c => { wts[c] = state.idealWeights?.[c] !== undefined ? state.idealWeights[c] : (DEF_WTS[c] || 0); });
            const totalIdealWt = activeCats.reduce((s, c) => s + (wts[c] || 0), 0);
            if (activeCats.length > 0 && totalIdealWt > 0) {
              const eqTotal = EQ_FUNDS.reduce((s, f) => s + (state.equity[f.id]?.shown || 0), 0);
              if (eqTotal > 0) {
                let drift = 0;
                activeCats.forEach(cat => {
                  const actual = EQ_FUNDS.filter(f => state.equity[f.id]?.category === cat)
                    .reduce((s, f) => s + (state.equity[f.id]?.shown || 0), 0);
                  drift += Math.abs((actual / eqTotal * 100) - (wts[cat] / totalIdealWt * 100));
                });
                aScore = Math.max(0, Math.round(25 - drift * 0.8));
                aNote = drift < 5 ? "On target" : drift < 15 ? Math.round(drift) + "% drift" : Math.round(drift) + "% drift — rebalance";
              }
            }

            // ── Dimension 3: Liquidity buffer (vs 6-month expenses) ──
            const totalLiqFree = LIQ_FUNDS.reduce((s, f) => s + Math.max(0, (state.liquid[f.id]?.value || 0) - (state.liquid[f.id]?.reserve || 0)), 0);
            const monthlyExp = totalMonthlyExpenses().total;
            let bScore = 15, bNote = "Enter expenses to measure", bufMonths = null;
            if (monthlyExp > 0) {
              bufMonths = totalLiqFree / monthlyExp;
              if (bufMonths >= 6)  { bScore = 25; bNote = bufMonths.toFixed(1) + " mo buffer"; }
              else if (bufMonths >= 3) { bScore = 17; bNote = bufMonths.toFixed(1) + " mo buffer (need 6)"; }
              else if (bufMonths >= 1) { bScore = 10; bNote = bufMonths.toFixed(1) + " mo buffer (need 6)"; }
              else                 { bScore = 0;  bNote = "< 1 month buffer"; }
            }

            // ── Dimension 4: Returns (portfolio XIRR) ──
            // Reuses cachedPortfolioXirr rather than re-deriving cash flows
            // inline — an earlier inline copy here ignored currentValue and
            // mis-signed redemptions as outflows, so this dimension could
            // silently disagree with the Portfolio XIRR card below it.
            let rScore = 12, rNote = "Add transactions to measure";
            const allTxns2 = (state.transactions || []).filter(t => t.date && Number(t.afterExpense ?? t.invested) > 0);
            const totalVal2 = LIQ_FUNDS.reduce((s, f) => s + (state.liquid[f.id]?.currentValue || state.liquid[f.id]?.value || 0), 0) +
                              EQ_FUNDS.reduce((s, f) => s + (state.equity[f.id]?.currentValue || state.equity[f.id]?.shown || 0), 0);
            if (allTxns2.length && totalVal2 > 0) {
              const xirr2 = cachedPortfolioXirr(allTxns2, totalVal2);
              if (xirr2 !== null) {
                const pct2 = xirr2 * 100;
                if (pct2 >= 18)      { rScore = 25; }
                else if (pct2 >= 12) { rScore = 20; }
                else if (pct2 >= 8)  { rScore = 15; }
                else if (pct2 >= 0)  { rScore = 8; }
                else                 { rScore = 0; }
                rNote = (pct2 >= 0 ? "+" : "") + pct2.toFixed(1) + "% XIRR";
              }
            }

            const total = cScore + aScore + bScore + rScore;
            const grade = total >= 80 ? "Excellent" : total >= 60 ? "Good" : total >= 40 ? "Fair" : "Needs Work";
            const gc    = total >= 80 ? "var(--mint)" : total >= 60 ? "var(--mint-soft)" : total >= 40 ? "var(--amber)" : "var(--coral)";

            // SVG arc gauge (225° start → sweeps clockwise 270° at 100%)
            const CX = 50, CY = 50, R = 36;
            function gPolar(deg) {
              const rad = (deg - 90) * Math.PI / 180;
              return { x: (CX + R * Math.cos(rad)).toFixed(1), y: (CY + R * Math.sin(rad)).toFixed(1) };
            }
            function gArc(startDeg, sweepDeg) {
              const endDeg = startDeg + sweepDeg;
              const s = gPolar(startDeg), e = gPolar(endDeg);
              return `M ${s.x} ${s.y} A ${R} ${R} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
            }
            const bgPath = gArc(225, 270);
            const fgSweep = Math.max(0, 270 * total / 100);
            const fgPath  = fgSweep > 1 ? gArc(225, fgSweep) : null;
            const fgArcLen = R * fgSweep * Math.PI / 180;

            const dims = [
              { label: "Consistency",  score: cScore, note: cNote, color: "var(--liq)",
                desc: "Consecutive months with investments: 25 pts at 24+ months, 20 at 12+, 15 at 6+, 10 at 3+, 5 at 1+." },
              { label: "Allocation",   score: aScore, note: aNote, color: "var(--mint)",
                desc: "25 pts minus your equity category drift from target weights (0.8 pts lost per 1% drift)." },
              { label: "Liq. Buffer",  score: bScore, note: bNote, color: "var(--amber)",
                desc: "Deployable liquid funds vs monthly expenses: 25 pts at 6+ months buffer, 17 at 3+, 10 at 1+, 0 below." },
              { label: "Returns",      score: rScore, note: rNote, color: "var(--purple)",
                desc: "Based on annualised portfolio XIRR: 25 pts at 18%+, 20 at 12%+, 15 at 8%+, 8 at 0%+, 0 if negative." },
            ];

            wrap.innerHTML = `
              <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
                <div style="flex-shrink:0;position:relative;width:100px;height:100px;">
                  <svg viewBox="0 0 100 100" style="width:100%;height:100%;overflow:visible;">
                    <path d="${bgPath}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="9" stroke-linecap="round"/>
                    ${fgPath ? `<path id="phsArcFg" d="${fgPath}" fill="none" stroke="${gc}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${fgArcLen.toFixed(1)}" stroke-dashoffset="${fgArcLen.toFixed(1)}"/>` : ""}
                  </svg>
                  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;margin-top:4px;">
                    <div id="phsScoreNum" style="font-family:'Roboto',sans-serif;font-size:28px;font-weight:700;color:${gc};line-height:1">0</div>
                    <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${grade}</div>
                  </div>
                </div>
                <div style="flex:1;min-width:180px;display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;">
                  ${dims.map(d => `
                    <div title="${d.desc}">
                      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                        <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--dim)">${d.label}</span>
                        <span style="font-family:'Roboto Mono',monospace;font-size:10.5px;font-weight:700;color:${d.color}">${d.score}/25</span>
                      </div>
                      <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:3px;">
                        <div class="phs-dim-bar" data-w="${(d.score / 25 * 100).toFixed(0)}" style="height:100%;width:0%;background:${d.color};border-radius:3px;"></div>
                      </div>
                      <div style="font-size:10.5px;color:var(--dim)">${d.note}</div>
                    </div>`).join("")}
                </div>
              </div>
              ${bufMonths !== null ? `
              <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:11px;color:var(--dim);">
                Emergency fund: <b style="color:${bufMonths >= 6 ? "var(--mint)" : bufMonths >= 3 ? "var(--amber)" : "var(--coral)"};font-family:'Roboto Mono',monospace">${bufMonths.toFixed(1)} months</b> of expenses covered
                (<span style="color:var(--txt)">${fmt(totalLiqFree)}</span> deployable liquid ÷ <span style="color:var(--txt)">${fmt(monthlyExp)}</span>/mo &mdash; see Expenses card below)
              </div>` : `
              <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:10.5px;color:var(--dim);">
                Add fixed expenses in the Expenses card below to measure this.
              </div>`}`;

            if (card) card.style.display = "";

            // Animate arc, score number, and dimension bars
            if (_animOnRender) {
              const arcEl = el("phsArcFg");
              if (arcEl && fgArcLen > 0) {
                const arcKey = "arc_phs";
                if (_animRaf[arcKey]) cancelAnimationFrame(_animRaf[arcKey]);
                const arcStart = performance.now();
                const arcTick = (now) => {
                  const t = Math.min(1, (now - arcStart) / 2000);
                  const ease = 1 - Math.pow(1 - t, 3);
                  arcEl.setAttribute("stroke-dashoffset", (fgArcLen * (1 - ease)).toFixed(2));
                  if (t < 1) _animRaf[arcKey] = requestAnimationFrame(arcTick);
                  else delete _animRaf[arcKey];
                };
                _animRaf[arcKey] = requestAnimationFrame(arcTick);
              }
              animateNumber(el("phsScoreNum"), total, 2000, true, "", true);
              wrap.querySelectorAll(".phs-dim-bar").forEach(bar => {
                animateWidth(bar, parseFloat(bar.dataset.w) || 0, 1400);
              });
            } else {
              const arcEl = el("phsArcFg");
              if (arcEl) arcEl.setAttribute("stroke-dashoffset", "0");
              const numEl = el("phsScoreNum");
              if (numEl) numEl.textContent = String(total);
              wrap.querySelectorAll(".phs-dim-bar").forEach(bar => {
                bar.style.width = (bar.dataset.w || "0") + "%";
              });
            }
          }

// Fixed items are a user-maintained itemized list (rent, EMIs, subscriptions,
// ...); the bank-spend line is fully derived from data the app already has
// (Net Worth tab's Bank field vs. last month's snapshot), so there's no
// input for it here — editing the underlying Bank value on the Net Worth
// tab is what moves this number.
function renderExpenses() {
            const card = el("sumExpensesCard");
            const wrap = el("sumExpensesBody");
            if (!card || !wrap) return;
            card.style.display = "";

            const items = state.surplus?.fixedExpenses || [];
            const { fixed, bankSpend, extra, total } = totalMonthlyExpenses();

            const rowStyle = (bg) => `background:${bg};border:1px solid ${editMode ? "var(--line)" : "transparent"};border-radius:5px;color:var(--txt);padding:4px 7px;${editMode ? "" : "cursor:default;"}`;
            const rows = items.map(item => `
              <div class="exp-row" style="display:grid;grid-template-columns:1fr 100px 18px;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);">
                <input class="exp-name-inp" data-id="${item.id}" value="${item.name || ""}" placeholder="Expense name" ${editMode ? "" : "readonly"}
                  style="${rowStyle(editMode ? "var(--input-bg,rgba(255,255,255,0.06))" : "transparent")}font-size:11.5px;width:100%;"/>
                <div style="display:flex;align-items:center;gap:3px;justify-content:flex-end;">
                  <span style="font-size:10px;color:var(--dim)">₹</span>
                  <input type="number" class="exp-amt-inp" data-id="${item.id}" min="0" step="100" value="${item.amount || ""}" placeholder="0" ${editMode ? "" : "readonly"}
                    style="${rowStyle(editMode ? "var(--input-bg,rgba(255,255,255,0.06))" : "transparent")}font-family:'Roboto Mono',monospace;font-size:11px;text-align:right;width:80px;"/>
                </div>
                <button class="exp-del-btn" data-id="${item.id}" style="visibility:${editMode ? "visible" : "hidden"};background:none;border:none;color:var(--coral);font-size:13px;cursor:pointer;padding:0;">✕</button>
              </div>`).join("");

            const emptyHtml = `<div style="font-size:11px;color:var(--dim);padding:8px 0;">
              ${editMode ? `No fixed expenses yet — use "+ Add Fixed Expense" below.` : `No fixed expenses added. Tap Edit to add rent, EMIs, subscriptions, etc.`}
            </div>`;

            // Fixed items are a BREAKDOWN of the bank drop, not a separate
            // spend on top of it — so this shows the bank drop as the real
            // total, with "extra" being whatever of that drop the fixed
            // plan doesn't account for (can go negative: less left the
            // account than was budgeted, e.g. a bill hasn't hit yet).
            const bankHtml = bankSpend
              ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:11px;color:var(--txt)">Bank balance this month</span>
                    <span style="font-family:'Roboto Mono',monospace;font-size:12px;color:var(--txt)">${fmt(bankSpend.openingBank)} &rarr; ${fmt(bankSpend.currentBank)}</span>
                  </div>
                  <div style="font-size:9px;color:var(--dim);margin-top:2px;">
                    As of ${fmtMonth(bankSpend.asOfKey)} snapshot vs. now on the Net Worth tab &mdash; a drop of ${fmt(bankSpend.amount)}
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                  <span style="font-size:11px;color:var(--txt)">${extra >= 0 ? "Extra beyond planned" : "Under planned"}</span>
                  <span style="font-family:'Roboto Mono',monospace;font-size:13px;font-weight:700;color:${extra > 0 ? "var(--amber)" : "var(--mint)"}">${extra >= 0 ? "+" : "−"}${fmt(Math.abs(extra))}</span>
                </div>`
              : `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:10.5px;color:var(--dim);">
                  Save a Net Worth snapshot to start tracking bank spending automatically &mdash; until then, Total This Month is just your planned fixed total below.
                </div>`;

            wrap.innerHTML = `
              <div>${rows || emptyHtml}</div>
              ${editMode ? `<button class="btn btn-ghost" id="expAddBtn" style="width:100%;font-size:11px;margin-top:8px;">+ Add Fixed Expense</button>` : ""}
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
                <span style="font-size:11px;color:var(--dim)">Planned (Fixed)</span>
                <span style="font-family:'Roboto Mono',monospace;font-size:12px;font-weight:700;color:var(--txt)">${fmt(fixed)}</span>
              </div>
              ${bankHtml}
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">
                <span style="font-size:12px;font-weight:700;color:var(--txt)">Total This Month</span>
                <span style="font-family:'Roboto Mono',monospace;font-size:18px;font-weight:700;color:var(--mint)">${fmt(total)}</span>
              </div>`;

            wrap.querySelectorAll(".exp-name-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                if (!editMode) { renderExpenses(); return; }
                const item = items.find(i => i.id === e.target.dataset.id);
                if (item) { item.name = e.target.value; saveState(); }
              });
            });
            wrap.querySelectorAll(".exp-amt-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                if (!editMode) { renderExpenses(); return; }
                const item = items.find(i => i.id === e.target.dataset.id);
                if (!item) return;
                item.amount = Math.max(0, parseFloat(e.target.value) || 0);
                saveState();
                renderExpenses();
                renderHealthScore();
                renderFireProgress();
              });
            });
            wrap.querySelectorAll(".exp-del-btn").forEach(btn => {
              btn.addEventListener("click", () => {
                if (!editMode) return;
                state.surplus.fixedExpenses = items.filter(i => i.id !== btn.dataset.id);
                saveState();
                renderExpenses();
                renderHealthScore();
                renderFireProgress();
              });
            });
            const addBtn = el("expAddBtn");
            if (addBtn) {
              addBtn.addEventListener("click", () => {
                if (!state.surplus.fixedExpenses) state.surplus.fixedExpenses = [];
                state.surplus.fixedExpenses.push({ id: "exp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), name: "", amount: 0 });
                saveState();
                renderExpenses();
              });
            }
          }

/* FI number = 25× annual expenses (the standard 4%-withdrawal-rate rule of
   thumb) — reuses the total the new Expenses card computes (fixed items +
   this month's auto bank-spend), and the same historical growth rate
   the Net Worth Projections card uses, so this card needs no state of its
   own beyond what's already tracked. */
function renderFireProgress() {
            const card = el("sumFireCard");
            const wrap = el("sumFireBody");
            if (!card || !wrap) return;

            const monthlyExp = totalMonthlyExpenses().total;
            if (monthlyExp <= 0) { card.style.display = "none"; return; }
            card.style.display = "";

            const fiTarget = monthlyExp * 12 * 25;
            const cur = nwTotal();
            const progressPct = fiTarget > 0 ? Math.min(100, (cur / fiTarget) * 100) : 0;

            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps).map(([k, v]) => normalizeSnap(k, v)).sort((a, b) => a.key.localeCompare(b.key));
            const r = sorted.length >= 2 ? avgMonthlyGrowthRate(sorted) : 0;

            let etaHtml;
            if (cur >= fiTarget) {
              etaHtml = `<span style="color:var(--mint);font-weight:600;">You've reached your FI number 🎉</span>`;
            } else if (sorted.length < 2 || r <= 0) {
              etaHtml = `<span style="color:var(--dim)">Add more monthly Net Worth snapshots to project a timeline.</span>`;
            } else {
              const monthsAway = Math.log(fiTarget / cur) / Math.log(1 + r);
              const yrsAway = monthsAway / 12;
              const etaDate = new Date();
              etaDate.setMonth(etaDate.getMonth() + Math.round(monthsAway));
              const etaLabel = etaDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
              etaHtml = `~<b style="color:var(--txt)">${yrsAway.toFixed(1)} years</b> away — projected <b style="color:var(--txt)">${etaLabel}</b> at your current net worth growth rate.`;
            }

            wrap.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
                <span style="font-size:11px;color:var(--dim)">Net worth <b style="color:var(--txt)">${fmt(cur)}</b> of <b style="color:var(--txt)">${fmt(fiTarget)}</b> FI number</span>
                <span style="font-family:'Roboto Mono',monospace;font-size:16px;font-weight:700;color:var(--mint)">${progressPct.toFixed(1)}%</span>
              </div>
              <div style="height:10px;background:rgba(255,255,255,0.06);border-radius:5px;overflow:hidden;margin-bottom:10px;">
                <div class="fire-bar" data-w="${progressPct.toFixed(1)}" style="height:100%;width:0%;background:linear-gradient(90deg,var(--liq),var(--mint));border-radius:5px;"></div>
              </div>
              <div style="font-size:11px;color:var(--dim);line-height:1.5;">${etaHtml}</div>
              <div style="font-size:9px;color:var(--dim);opacity:0.75;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
                FI number = 25× annual expenses (4% withdrawal rule) — a rough target, not investment advice.
              </div>`;

            const bar = wrap.querySelector(".fire-bar");
            if (bar) {
              if (_animOnRender) animateWidth(bar, progressPct, 1200);
              else bar.style.width = progressPct + "%";
            }
          }

export function renderSparklines() {
            const now = new Date();
            const months = [];
            for (let i = 11; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              months.push(d.toISOString().slice(0, 7));
            }
            const allFunds = [...LIQ_FUNDS.map(f => ({ ...f, isLiq: true })), ...EQ_FUNDS.map(f => ({ ...f, isLiq: false }))];
            allFunds.forEach(({ id, isLiq }) => {
              const sparkEl = el("spark-" + id);
              if (!sparkEl) return;
              const txns = (state.transactions || []).filter(t => t.fundId === id && t.date);
              if (!txns.length) { sparkEl.innerHTML = ""; return; }

              const byMonth = {};
              months.forEach(m => { byMonth[m] = 0; });
              txns.forEach(t => {
                const mo = t.date.slice(0, 7);
                if (byMonth[mo] !== undefined) byMonth[mo] += Number(t.invested) || 0;
              });

              const vals = months.map(m => byMonth[m]);
              const maxV = Math.max(...vals, 1);
              const hasData = vals.some(v => v > 0);
              if (!hasData) { sparkEl.innerHTML = ""; return; }

              const W = 200, H = 28, bw = Math.max(3, (W / months.length) - 2);
              const bars = vals.map((v, i) => {
                const bh = Math.max(0, (v / maxV) * (H - 4));
                const x = i * (W / months.length) + (W / months.length - bw) / 2;
                const y = H - bh;
                const color = isLiq ? "var(--liq)" : "var(--mint)";
                return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="1.5" fill="${color}" opacity="${v > 0 ? "0.8" : "0.15"}"/>`;
              }).join("");

              sparkEl.innerHTML = `<div style="font-size:8px;color:var(--dim);margin-bottom:3px">Last 12 months</div>
                <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;">${bars}</svg>`;
            });
          }

/* Small trend line inside the Portfolio XIRR card — recomputes XIRR as of
   each historical net worth snapshot (see rollingPortfolioXirr) rather than
   just showing today's single number, so a slipping/improving return rate
   is visible at a glance. Needs 3+ snapshots with a computable XIRR to be
   worth showing as a "trend" at all. */
function renderXirrTrend() {
            const wrap = el("sumXirrTrendWrap");
            const svg  = el("sumXirrTrend");
            if (!wrap || !svg) return;

            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps).map(([k, v]) => normalizeSnap(k, v)).sort((a, b) => a.key.localeCompare(b.key));
            const points = rollingPortfolioXirr(sorted).filter(p => p.xirr !== null);

            if (points.length < 3) { wrap.style.display = "none"; return; }
            wrap.style.display = "";

            const vals = points.map(p => p.xirr * 100);
            const minV = Math.min(...vals, 0), maxV = Math.max(...vals, 0);
            const range = (maxV - minV) || 1;
            const W = 300, H = 44, P = 4;
            const n = vals.length;
            const toX = i => P + (i / (n - 1)) * (W - P * 2);
            const toY = v => H - P - ((v - minV) / range) * (H - P * 2);
            const zeroY = toY(0).toFixed(1);

            const lineStr = vals.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
            const last = vals[n - 1];
            const lastColor = last >= 0 ? "var(--mint)" : "var(--coral)";

            svg.innerHTML = `
              <line x1="${P}" y1="${zeroY}" x2="${W - P}" y2="${zeroY}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3,3"/>
              <path d="${lineStr}" fill="none" stroke="${lastColor}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
              <circle cx="${toX(n - 1).toFixed(1)}" cy="${toY(last).toFixed(1)}" r="2.5" fill="${lastColor}"/>
            `;
          }

export function renderXirrAndHeatmap() {
            // Portfolio XIRR — per-fund breakdown lives in the Fund
            // Performance table's sortable XIRR column + Portfolio total
            // row below, so this card only needs the headline number.
            const xirrCard = el("sumXirrCard");
            const xirrEl = el("sumXirr");
            if (xirrCard && xirrEl) {
              const portfolioXirr = portfolioXirrSummary();
              if (portfolioXirr !== null) {
                xirrCard.style.display = "";
                const pct = (portfolioXirr * 100).toFixed(2);
                const isUp = portfolioXirr >= 0;
                xirrEl.textContent = (isUp ? "+" : "") + pct + "%";
                xirrEl.style.color = isUp ? "var(--mint)" : "var(--coral)";
              } else {
                xirrCard.style.display = "none";
              }
            }
            renderXirrTrend();

            // Investment streak
            const streakWrap = el("sumStreakWrap");
            if (streakWrap) {
              const months = new Set((state.transactions || [])
                .filter(t => t.type !== "redemption" && t.date)
                .map(t => t.date.slice(0, 7)));
              const now = new Date();
              let streak = 0;
              for (let i = 0; i < 120; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
                if (months.has(key)) streak++;
                else if (i > 0) break;
              }
              if (streak >= 2) {
                el("sumStreakCount").textContent = streak;
                el("sumStreakLabel").textContent = `consecutive month${streak !== 1 ? "s" : ""} investing`;
                const rangeEl = el("sumStreakRange");
                if (rangeEl) {
                  const startD = new Date(now.getFullYear(), now.getMonth() - (streak - 1), 1);
                  const fmtMo = d => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
                  rangeEl.textContent = `${fmtMo(startD)} – ${fmtMo(now)}`;
                }
                streakWrap.style.display = "";
              } else {
                streakWrap.style.display = "none";
              }
            }

            // Returns heatmap using networth snapshots
            const hmCard = el("sumHeatmapCard");
            const hmEl = el("sumHeatmap");
            if (hmCard && hmEl) {
              const snaps = state.networth.snapshots || {};
              const sorted = Object.entries(snaps).map(([k, v]) => normalizeSnap(k, v)).sort((a, b) => a.key.localeCompare(b.key));
              if (sorted.length < 2) { hmCard.style.display = "none"; }
              else {
                hmCard.style.display = "";

                // Best/worst month-over-month % change, and max peak-to-trough
                // drawdown — computed over the FULL snapshot history, unlike
                // the heatmap grid below which only shows the last 12 months.
                const fmtMo = key => new Date(key + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
                let bestMo = null, worstMo = null;
                let peak = sorted[0].total, peakKey = sorted[0].key;
                let maxDD = 0, maxDDPeakKey = null, maxDDTroughKey = null;
                for (let i = 1; i < sorted.length; i++) {
                  const prev = sorted[i - 1], curr = sorted[i];
                  if (prev.total > 0) {
                    const chPct = (curr.total - prev.total) / prev.total * 100;
                    if (!bestMo || chPct > bestMo.pct) bestMo = { key: curr.key, pct: chPct };
                    if (!worstMo || chPct < worstMo.pct) worstMo = { key: curr.key, pct: chPct };
                  }
                  if (curr.total > peak) { peak = curr.total; peakKey = curr.key; }
                  else if (peak > 0) {
                    const ddPct = (curr.total - peak) / peak * 100;
                    if (ddPct < maxDD) { maxDD = ddPct; maxDDPeakKey = peakKey; maxDDTroughKey = curr.key; }
                  }
                }
                const statsHtml = (bestMo || worstMo || maxDD < 0) ? `
                  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line);">
                    ${bestMo ? `<div>
                      <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Best Month</div>
                      <div style="font-family:'Roboto Mono',monospace;font-size:13px;font-weight:700;color:var(--mint)">+${bestMo.pct.toFixed(1)}%</div>
                      <div style="font-size:9px;color:var(--dim)">${fmtMo(bestMo.key)}</div>
                    </div>` : ""}
                    ${worstMo ? `<div>
                      <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Worst Month</div>
                      <div style="font-family:'Roboto Mono',monospace;font-size:13px;font-weight:700;color:${worstMo.pct < 0 ? "var(--coral)" : "var(--mint)"}">${worstMo.pct >= 0 ? "+" : ""}${worstMo.pct.toFixed(1)}%</div>
                      <div style="font-size:9px;color:var(--dim)">${fmtMo(worstMo.key)}</div>
                    </div>` : ""}
                    ${maxDD < 0 ? `<div>
                      <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Max Drawdown</div>
                      <div style="font-family:'Roboto Mono',monospace;font-size:13px;font-weight:700;color:var(--coral)">${maxDD.toFixed(1)}%</div>
                      <div style="font-size:9px;color:var(--dim)">${fmtMo(maxDDPeakKey)} → ${fmtMo(maxDDTroughKey)}</div>
                    </div>` : ""}
                  </div>` : "";

                const rows = sorted.slice(-12).map((s, i, arr) => {
                  const prev = arr[i - 1];
                  const delta = prev ? s.total - prev.total : null;
                  const pct = prev && prev.total > 0 ? ((s.total - prev.total) / prev.total * 100) : null;
                  const color = delta === null ? "transparent" : delta >= 0 ? `rgba(0,245,160,${Math.min(0.7, Math.abs(pct || 0) / 10)})` : `rgba(248,113,113,${Math.min(0.7, Math.abs(pct || 0) / 10)})`;
                  const lbl = new Date(s.key + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
                  return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;min-width:48px;padding:6px 4px;background:${color};border-radius:6px;border:1px solid var(--line);">
                    <div style="font-size:8px;color:var(--dim);font-family:'Roboto Mono',monospace;">${lbl}</div>
                    <div style="font-size:10px;font-weight:700;color:${delta === null ? "var(--dim)" : delta >= 0 ? "var(--mint)" : "var(--coral)"};">${delta !== null ? (delta >= 0 ? "+" : "−") + fmt(Math.abs(delta)) : "—"}</div>
                    <div style="font-size:8px;color:var(--dim);">${pct !== null ? (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%" : ""}</div>
                  </div>`;
                }).join("");
                hmEl.innerHTML = `${statsHtml}<div style="display:flex;gap:6px;flex-wrap:wrap;">${rows}</div>
                  <div style="font-size:9px;color:var(--dim);margin-top:8px;">Darker = bigger month-over-month swing, green = gain, red = loss.</div>`;
              }
            }
          }

export function copySummary() {
            const lines = ["*MF Portfolio Plan*", ""];
            lines.push("EQUITY FUNDS");
            EQ_FUNDS.forEach((f) => {
              const s = state.equity[f.id];
              const name = s.name || f.defaultName;
              const inv = el("einv-" + f.id).textContent;
              lines.push("  " + name + ": invest " + inv);
            });
            lines.push("");
            lines.push(
              "Equity now " +
                el("eqCur").textContent +
                " → target " +
                el("eqTgt").textContent,
            );
            lines.push("Equity to invest: " + el("eqInv").textContent);

            navigator.clipboard
              .writeText(lines.join("\n"))
              .then(() => {
                const b = el("copyBtn"),
                  o = b.textContent;
                b.textContent = "Copied ✓";
                setTimeout(() => (b.textContent = o), 1600);
              })
              .catch(() => alert(lines.join("\n")));
          }
