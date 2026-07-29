import { _animOnRender, animateNumber } from "../../core/animate.js";
import { editMode, state } from "../../core/state.js";
import { el } from "../../core/dom.js";
import { fcGoalMonthly, fcProjectedAdv, fcTotalInvested } from "../../domain/forecastMath.js";
import { fmt, num } from "../../core/format.js";

export let fcCompareEditMode = false;

// Scratch "what if" draft — same non-persisted, session-only convention
// as this input always had (never written to state.forecast); a plain
// module variable rather than a DOM read since the whole section now
// gets rebuilt via innerHTML on every render (see renderFcCompare()).
let fcCompareExtraDraft = 0;

export function renderForecast() {
            const fc = state.forecast || {};
            const mode = fc.mode || "project";

            // Show/hide mode panels
            const projInputs = el("fcProjectInputs");
            const goalInputs = el("fcGoalInputs");
            const scenRow    = el("fcScenarioRow");
            const dispEl     = el("fcDisplay");
            const chartWrap  = document.querySelector(".fc-chart-wrap");
            const sliderWrap = document.querySelector(".fc-slider-wrap");
            const compareWrap = el("fcCompareWrap");

            if (projInputs) projInputs.style.display = mode === "project" ? "" : "none";
            if (goalInputs) goalInputs.style.display  = mode === "goal"    ? "" : "none";
            if (scenRow)    scenRow.style.display      = mode === "project" ? "" : "none";
            if (dispEl)     dispEl.style.display       = mode === "project" ? "" : "none";
            if (chartWrap)  chartWrap.style.display    = mode === "project" ? "" : "none";
            if (sliderWrap) sliderWrap.style.display   = mode === "project" ? "" : "none";
            if (compareWrap) compareWrap.style.display = mode === "project" ? "" : "none";

            if (mode === "goal") { renderGoalMode(); return; }

            // ── Projection mode ──
            const invest  = fc.investments   || 0;
            const monthly = fc.monthlyInvest || 0;
            const rate    = fc.annualRate    != null ? fc.annualRate : 12;
            const stepUp  = fc.stepUp        || 0;
            const inflation = fc.inflationRate != null ? fc.inflationRate : 6;
            const useInflation = fc.useInflation || false;
            const scenario = fc.fcScenario   || "base";
            const showAll  = fc.fcShowAll    || false;

            const activeRate = scenario === "cons" ? 8 : scenario === "aggr" ? 15 : rate;

            const sliderEl = el("fcSlider");
            const step     = sliderEl ? parseInt(sliderEl.value, 10) : 0;
            const T        = step * 0.5;

            let projected = fcProjectedAdv(0, invest, monthly, activeRate, T, stepUp);
            let totalInvested = fcTotalInvested(0, invest, monthly, T, stepUp);

            // Inflation adjustment
            if (useInflation && T > 0) {
              projected = projected / Math.pow(1 + inflation / 100, T);
              totalInvested = totalInvested / Math.pow(1 + inflation / 100, T);
            }

            const profit    = projected - totalInvested;
            const profitPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

            let timeLabel;
            if (step === 0)               timeLabel = "Now";
            else if (T < 1)               timeLabel = "6 months";
            else if (T === Math.floor(T)) timeLabel = T + " year" + (T !== 1 ? "s" : "");
            else                          timeLabel = T + " years";
            if (useInflation && step > 0) timeLabel += " (real)";

            const timeBadge = el("fcTimeBadge");
            if (!timeBadge) return;
            timeBadge.textContent = timeLabel;
            if (_animOnRender && !editMode) {
              animateNumber(el("fcInvested"), Math.round(totalInvested), 2000, true);
              animateNumber(el("fcBig"), Math.round(projected), 2000, true);
            } else {
              el("fcInvested").textContent = fmt(Math.round(totalInvested));
              el("fcBig").textContent      = fmt(Math.round(projected));
            }

            const profitEl = el("fcProfit"), pctEl = el("fcProfitPct");
            if (step === 0 || totalInvested === 0) {
              profitEl.textContent = "—"; profitEl.style.color = "var(--dim)";
              pctEl.textContent = ""; pctEl.style.color = "var(--dim)";
            } else {
              const sign = profit >= 0 ? "+" : "";
              profitEl.style.color = profit >= 0 ? "var(--mint)" : "var(--coral)";
              pctEl.textContent = sign + profitPct.toFixed(1) + "%";
              pctEl.style.color = profit >= 0 ? "var(--mint)" : "var(--coral)";
              if (_animOnRender && !editMode && profit > 0) {
                animateNumber(profitEl, Math.round(profit), 2000, true, "+");
              } else {
                profitEl.textContent = sign + fmt(Math.round(profit));
              }
            }

            drawForecastChart(invest, monthly, rate, activeRate, step, stepUp, inflation, useInflation, showAll, scenario);
            updateFcSliderFill(step);

            // What-if: extra monthly contribution, at the same rate/step-
            // up/time horizon the slider + scenario picker above already
            // use — reuses fcProjectedAdv() rather than a second model, so
            // this always agrees with whatever the main projection shows.
            renderFcCompare({ invest, monthly, activeRate, T, stepUp, useInflation, inflation, timeLabel, projected, step });

            // Sync inputs
            const safe = (id, v) => { const e = el(id); if (e && document.activeElement !== e) e.value = v || ""; };
            safe("fcInvest", invest); safe("fcMonthly", monthly);
            safe("fcRate", rate); safe("fcStepUp", stepUp);
            const fcInflEl = el("fcInflation");
            if (fcInflEl) fcInflEl.checked = useInflation;
          }

// "What If You Invested More?" — a dedicated Edit/Done toggle instead of
// an always-editable field, same local-edit-mode convention as Rebalance/
// Invest New Money (independent of the app's blanket Edit mode). Editing
// shows just the input, with no live result underneath — this whole
// section is rebuilt via innerHTML on every renderForecast() call (slider
// drags, scenario switches, etc.), so a per-keystroke listener would
// fight the user's own typing; the comparison only (re)computes once
// Done is tapped, matching how Invest New Money's own Edit/Done works.
function renderFcCompare(ctx) {
            const wrap = el("fcCompareWrap");
            if (!wrap) return;

            const em = fcCompareEditMode;

            let bodyHtml;
            if (em) {
              bodyHtml = `
                <div class="field" style="margin-top:12px;margin-bottom:0;">
                  <label class="flabel" for="fcCompareExtra">Extra amount per month</label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num" id="fcCompareExtra" type="number" min="0" placeholder="0" inputmode="numeric" value="${fcCompareExtraDraft || ""}"/>
                  </div>
                </div>`;
            } else if (fcCompareExtraDraft <= 0) {
              bodyHtml = `<div style="font-size:11px;color:var(--dim);padding:2px 0 4px;">Tap Edit to compare an extra monthly contribution.</div>`;
            } else if (ctx.step <= 0) {
              bodyHtml = `<div style="font-size:11px;color:var(--dim);padding:2px 0 4px;">Move the year slider above to see a projection.</div>`;
            } else {
              let withExtra = fcProjectedAdv(0, ctx.invest, ctx.monthly + fcCompareExtraDraft, ctx.activeRate, ctx.T, ctx.stepUp);
              if (ctx.useInflation && ctx.T > 0) withExtra /= Math.pow(1 + ctx.inflation / 100, ctx.T);
              const diff = withExtra - ctx.projected;
              const diffPct = ctx.projected > 0 ? (diff / ctx.projected) * 100 : 0;
              bodyHtml = `
                <div style="font-size:10px;color:var(--dim);margin:10px 0 12px;">+${fmt(fcCompareExtraDraft)}/mo more, at ${ctx.timeLabel}</div>
                <div class="fc-compare-grid">
                  <div class="fc-compare-stat">
                    <div class="fc-compare-stat-lbl">Without Extra</div>
                    <div class="fc-compare-stat-val">${fmt(Math.round(ctx.projected))}</div>
                  </div>
                  <div class="fc-compare-arrow">&rarr;</div>
                  <div class="fc-compare-stat fc-compare-stat-hi">
                    <div class="fc-compare-stat-lbl">With Extra</div>
                    <div class="fc-compare-stat-val">${fmt(Math.round(withExtra))}</div>
                  </div>
                </div>
                <div class="fc-compare-delta">
                  <span class="fc-compare-delta-amt">+${fmt(Math.round(diff))}</span>
                  <span class="fc-compare-delta-sub">more${ctx.projected > 0 ? ` (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%)` : ""}</span>
                </div>`;
            }

            wrap.innerHTML = `
              <div class="reb-page-head" style="margin-bottom:14px;padding-bottom:12px;">
                <div style="flex:1;">
                  <div class="sec-head" style="margin-bottom:4px;">What If You Invested More?</div>
                  <div style="font-size:10px;color:var(--dim);">Compare an extra monthly contribution at the same horizon and return rate</div>
                </div>
                <button class="reb-edit-btn${em ? " done" : ""}" id="fcCompareEditToggle">${em ? "Done" : "Edit"}</button>
              </div>
              ${bodyHtml}`;

            el("fcCompareEditToggle").addEventListener("click", () => {
              fcCompareEditMode = !fcCompareEditMode;
              renderForecast();
            });

            const inp = el("fcCompareExtra");
            if (inp) {
              inp.addEventListener("change", e => {
                fcCompareExtraDraft = Math.max(0, num(e.target.value));
                renderForecast();
              });
            }
          }

export function renderGoalMode() {
            const fc = state.forecast || {};
            const bank    = fc.goalBank   || 0;
            const target  = fc.goalTarget || 0;
            const years   = fc.goalYears  || 10;
            const rate    = fc.goalRate   || 12;
            const stepUp  = fc.stepUp     || 0;

            const safe = (id, v) => { const e = el(id); if (e && document.activeElement !== e) e.value = v || ""; };
            safe("fcGoalBank", bank); safe("fcGoalTarget", target);
            safe("fcGoalYears", years); safe("fcGoalRate", rate);

            const resultEl = el("fcGoalResult");
            if (!resultEl) return;
            if (!target || !years) {
              resultEl.innerHTML = `<div style="font-size:11px;color:var(--dim)">Enter your target corpus and time horizon.</div>`;
              return;
            }
            const needed = fcGoalMonthly(bank, 0, rate, years, stepUp, target);
            const projected = fcProjectedAdv(bank, 0, needed, rate, years, stepUp);
            resultEl.innerHTML = `
              <div class="fc-goal-result">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:var(--dim);margin-bottom:8px">Required Monthly Investment</div>
                <div class="fc-goal-amount">${fmt(needed)}</div>
                <div class="fc-goal-label">to reach ${fmt(target)} in ${years} year${years !== 1 ? "s" : ""} at ${rate}% p.a.${stepUp > 0 ? ` (${stepUp}% step-up)` : ""}</div>
                <div style="display:flex;gap:12px;justify-content:center;margin-top:12px;flex-wrap:wrap;">
                  <div style="text-align:center"><div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px">Invested</div><div style="font-family:'Roboto Mono',monospace;font-size:13px;font-weight:700;color:var(--txt)">${fmt(Math.round(fcTotalInvested(bank, 0, needed, years, stepUp)))}</div></div>
                  <div style="text-align:center"><div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px">Returns</div><div style="font-family:'Roboto Mono',monospace;font-size:13px;font-weight:700;color:var(--mint)">+${fmt(Math.round(projected - fcTotalInvested(bank, 0, needed, years, stepUp)))}</div></div>
                </div>
              </div>`;
          }

export function drawForecastChart(invest, monthly, rate, activeRate, currentStep, stepUp = 0, inflation = 6, useInflation = false, showAll = false, scenario = "base") {
            const svg = el("fcChart");
            if (!svg) return;
            const W = 600, H = 110, PAD_T = 12, PAD_B = 18;

            const scenarios = showAll
              ? [{ key: "cons", rate: 8, color: "var(--amber)", label: "8%" }, { key: "base", rate, color: "var(--mint)", label: rate + "%" }, { key: "aggr", rate: 15, color: "#4ade80", label: "15%" }]
              : [{ key: scenario, rate: activeRate, color: "var(--mint)", label: activeRate + "%" }];

            const allPts = scenarios.map(sc => {
              const pts = [];
              for (let i = 0; i <= 60; i++) {
                let v = fcProjectedAdv(0, invest, monthly, sc.rate, i * 0.5, stepUp);
                if (useInflation && i > 0) v /= Math.pow(1 + inflation / 100, i * 0.5);
                pts.push(v);
              }
              return { ...sc, pts };
            });

            const allVals = allPts.flatMap(s => s.pts);
            const minV = allVals[0];
            const maxV = Math.max(...allVals);
            const range = maxV - minV || 1;

            const toX = i => (i / 60) * W;
            const toY = v => H - PAD_B - ((v - minV) / range) * (H - PAD_T - PAD_B);

            const activeIdx = showAll ? Math.max(0, scenarios.findIndex(s => s.key === scenario)) : 0;
            const activePts = allPts[activeIdx].pts;
            const cx = toX(currentStep);
            const cy = toY(activePts[currentStep]);

            const areaPath = `M ${toX(0).toFixed(1)},${H} ` +
              activePts.map((v, i) => `L ${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ") + ` L ${W},${H} Z`;

            const tickLabels = [0,10,20,30,40,50,60].map(i => {
              const x = toX(i); const yr = i / 2;
              return `<text x="${x.toFixed(1)}" y="${H - 3}" text-anchor="${i === 0 ? "start" : i === 60 ? "end" : "middle"}" font-size="8" fill="var(--dim)" font-family="Roboto Mono, monospace">${yr === 0 ? "Now" : yr + "y"}</text>`;
            }).join("");

            const lines = allPts.map((sc, idx) => {
              const pts = sc.pts.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
              const isMain = !showAll || idx === activeIdx;
              return `<polyline points="${pts}" fill="none" stroke="${sc.color}" stroke-width="${isMain ? 1.8 : 1.2}" stroke-linejoin="round" stroke-linecap="round" ${!isMain ? 'stroke-dasharray="4,3" opacity="0.7"' : ""}/>`;
            }).join("");

            svg.innerHTML = `
              <defs>
                <linearGradient id="fcAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--mint)" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="var(--mint)" stop-opacity="0.02"/>
                </linearGradient>
              </defs>
              <path d="${areaPath}" fill="url(#fcAreaGrad)"/>
              ${lines}
              <line x1="${cx.toFixed(1)}" y1="${PAD_T}" x2="${cx.toFixed(1)}" y2="${H - PAD_B}" stroke="var(--mint)" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
              <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="var(--mint)" filter="drop-shadow(0 0 4px var(--mint))"/>
              ${tickLabels}
            `;
          }

export function updateFcSliderFill(step) {
            const slider = el("fcSlider");
            if (!slider) return;
            const pct = (step / 60) * 100;
            slider.style.background =
              `linear-gradient(to right, var(--mint) 0%, var(--mint) ${pct}%, var(--line) ${pct}%, var(--line) 100%)`;
          }

export const fcStepUpEl = el("fcStepUp");

export const fcInflEl = el("fcInflation");

export const fcShowAllEl = el("fcShowAll");
