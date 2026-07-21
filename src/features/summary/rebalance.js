import { ALLOC_PALETTE } from "../portfolio/allocation.js";
import { EQ_CATEGORIES } from "../../core/constants.js";
import { EQ_FUNDS, LIQ_FUNDS, defaultRebSections, deployable, editMode, saveState, state } from "../../core/state.js";
import { _animOnRender, animateWidth } from "../../core/animate.js";
import { el } from "../../core/dom.js";
import { fmt, fmtCompact, pct } from "../../core/format.js";
import { navigateTo } from "../../core/ui.js";

export let rebEditMode = false;

export function rebFmtDiff(d) {
            const abs = Math.abs(d);
            const sign = d > 0 ? "+" : d < 0 ? "−" : "";
            return sign + "₹" + abs.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
          }

export function rebDiff(mm, real) {
            const d = real - mm;
            const txt = mm === 0 && real === 0 ? "—" : rebFmtDiff(d);
            const cls = "reb-diff" + (d > 0 ? " up" : d < 0 ? " dn" : "");
            return { txt, cls };
          }

export function rebUid() { return "r_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6); }

export function rebSuid() { return "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6); }

export function renderRebalance() {
            const wrap = el("rebPageContent");
            if (!wrap) return;
            if (!state.rebalance?.sections) state.rebalance = { sections: defaultRebSections() };
            const secs = state.rebalance.sections;
            const em = rebEditMode;

            let html = `<div class="reb-page-head">
              <button class="reb-back-btn" id="rebBackBtn">&#8592;</button>
              <span class="reb-page-title">Rebalance</span>
              <button class="reb-edit-btn${em ? " done" : ""}" id="rebEditToggle">${em ? "Done" : "Edit"}</button>
            </div>
            <div${em ? ' class="reb-edit-mode"' : ""}>`;

            secs.forEach((sec, si) => {
              let mmT = 0, realT = 0;
              sec.rows.forEach(r => { mmT += r.mm || 0; realT += r.real || 0; });
              const tot = rebDiff(mmT, realT);

              html += `<div class="reb-table-wrap" style="margin-bottom:10px">
                <div class="reb-col-hdrs">
                  <div class="reb-ch">
                    ${em
                      ? `<input class="reb-section-name-inp" data-si="${si}" value="${sec.name}" placeholder="Section name">`
                      : `<span class="reb-section-name">${sec.name}</span>`}
                  </div>
                  <div class="reb-ch">MM</div>
                  <div class="reb-ch">Real</div>
                  <div class="reb-ch">Diff</div>
                </div>`;

              sec.rows.forEach((row, ri) => {
                const mm = row.mm || 0, real = row.real || 0;
                const d = rebDiff(mm, real);
                html += `<div class="reb-row">
                  <div class="reb-label-cell">
                    ${em
                      ? `<input class="reb-label-inp" data-si="${si}" data-ri="${ri}" value="${row.name}" placeholder="Name">`
                      : `<span class="reb-label">${row.name}</span>`}
                    <button class="reb-icon-btn del" data-si="${si}" data-ri="${ri}" title="Delete row">✕</button>
                  </div>
                  <input class="reb-inp" type="number" inputmode="numeric" placeholder="0"
                    data-si="${si}" data-ri="${ri}" data-col="mm" value="${mm || ""}">
                  <input class="reb-inp" type="number" inputmode="numeric" placeholder="0"
                    data-si="${si}" data-ri="${ri}" data-col="real" value="${real || ""}">
                  <div class="reb-diff ${d.cls.replace("reb-diff","").trim()}">${d.txt}</div>
                </div>`;
              });

              // total row (only if >1 row)
              if (sec.rows.length > 1) {
                html += `<div class="reb-total-row">
                  <div class="reb-total-label">Total</div>
                  <div class="reb-total-val">${fmtCompact(mmT)}</div>
                  <div class="reb-total-val">${fmtCompact(realT)}</div>
                  <div class="${tot.cls}">${tot.txt}</div>
                </div>`;
              }

              html += `<button class="reb-add-row-btn" data-si="${si}">+ Add Sub-section</button>`;

              // section delete icon lives as overlay button after header in edit mode
              if (em) {
                html += `<button class="btn btn-ghost" style="width:100%;font-size:11px;color:#f87171;border-top:1px solid rgba(248,113,113,0.15);border-radius:0 0 13px 13px;padding:9px;"
                  data-del-sec="${si}">Remove "${sec.name}" section</button>`;
              }

              html += `</div>`;
            });

            html += `<button class="reb-add-section-btn" id="rebAddSec">+ Add Section</button>`;
            html += `</div>`;

            wrap.innerHTML = html;

            // ── event listeners on freshly rendered DOM ──

            el("rebBackBtn").addEventListener("click", () => { navigateTo("portfolio"); });

            el("rebEditToggle").addEventListener("click", () => {
              rebEditMode = !rebEditMode;
              renderRebalance();
            });

            // Section name edits
            wrap.querySelectorAll(".reb-section-name-inp").forEach(inp => {
              inp.addEventListener("input", () => {
                const si = +inp.dataset.si;
                state.rebalance.sections[si].name = inp.value;
                saveState();
              });
            });

            // Row name edits
            wrap.querySelectorAll(".reb-label-inp").forEach(inp => {
              inp.addEventListener("input", () => {
                const si = +inp.dataset.si, ri = +inp.dataset.ri;
                state.rebalance.sections[si].rows[ri].name = inp.value;
                saveState();
              });
            });

            // MM / Real value inputs
            wrap.querySelectorAll(".reb-inp").forEach(inp => {
              inp.addEventListener("input", () => {
                const si = +inp.dataset.si, ri = +inp.dataset.ri, col = inp.dataset.col;
                state.rebalance.sections[si].rows[ri][col] = parseFloat(inp.value) || 0;
                // live-update diff cell in same row
                const row = state.rebalance.sections[si].rows[ri];
                const diffEl = inp.closest(".reb-row")?.querySelector(".reb-diff");
                if (diffEl) {
                  const d = rebDiff(row.mm || 0, row.real || 0);
                  diffEl.textContent = d.txt;
                  diffEl.className = d.cls;
                }
                // update total row
                let mmT = 0, realT = 0;
                state.rebalance.sections[si].rows.forEach(r => { mmT += r.mm || 0; realT += r.real || 0; });
                const totRow = inp.closest(".reb-table-wrap")?.querySelector(".reb-total-row");
                if (totRow) {
                  const cells = totRow.querySelectorAll(".reb-total-val");
                  if (cells[0]) cells[0].textContent = fmtCompact(mmT);
                  if (cells[1]) cells[1].textContent = fmtCompact(realT);
                  const totDiff = totRow.querySelector(".reb-diff");
                  if (totDiff) { const d = rebDiff(mmT, realT); totDiff.textContent = d.txt; totDiff.className = d.cls; }
                }
                saveState();
              });
            });

            // Delete row buttons
            wrap.querySelectorAll(".reb-icon-btn.del").forEach(btn => {
              btn.addEventListener("click", () => {
                const si = +btn.dataset.si, ri = +btn.dataset.ri;
                state.rebalance.sections[si].rows.splice(ri, 1);
                saveState();
                renderRebalance();
              });
            });

            // Delete section buttons
            wrap.querySelectorAll("[data-del-sec]").forEach(btn => {
              btn.addEventListener("click", () => {
                const si = +btn.dataset.delSec;
                state.rebalance.sections.splice(si, 1);
                saveState();
                renderRebalance();
              });
            });

            // Add row buttons
            wrap.querySelectorAll(".reb-add-row-btn").forEach(btn => {
              btn.addEventListener("click", () => {
                const si = +btn.dataset.si;
                state.rebalance.sections[si].rows.push({ id: rebUid(), name: "New", mm: 0, real: 0 });
                saveState();
                renderRebalance();
              });
            });

            // Add section button
            el("rebAddSec")?.addEventListener("click", () => {
              state.rebalance.sections.push({ id: rebSuid(), name: "New Section", rows: [{ id: rebUid(), name: "Total", mm: 0, real: 0 }] });
              saveState();
              renderRebalance();
            });
          }

export function renderIdealAlloc() {
            const editorEl = el("idealWeightsEditor");
            const bar1El   = el("idealAllocBarSection");
            const bar2El   = el("rebalMoveSection");
            const bar3El   = el("afterRebalBarSection");
            if (!editorEl) return;

            if (!state.idealWeights) state.idealWeights = {};
            const DEF_WEIGHTS = { "Large Cap": 45, "Flexi Cap": 33, "Mid Cap": 22 };

            const weights = {};
            EQ_CATEGORIES.forEach(cat => {
              weights[cat] = state.idealWeights[cat] !== undefined
                ? state.idealWeights[cat]
                : (DEF_WEIGHTS[cat] || 0);
            });

            // Only show categories that are actually assigned to active equity funds
            const activeCats = [...new Set(
              EQ_FUNDS.map(f => state.equity[f.id]?.category).filter(c => c && c !== "")
            )].sort((a, b) => EQ_CATEGORIES.indexOf(a) - EQ_CATEGORIES.indexOf(b));

            const totalWeight = activeCats.reduce((s, cat) => s + (weights[cat] || 0), 0);
            const weightOk = Math.abs(totalWeight - 100) < 0.5;

            // --- Editable weights section ---
            if (activeCats.length === 0) {
              editorEl.innerHTML = `
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:var(--dim);margin-bottom:7px">Target Equity Split</div>
                <div style="font-size:11px;color:var(--dim);padding:8px 0;">
                  No categories assigned. Go to the <b style="color:var(--txt)">Portfolio tab</b> → edit each equity fund → set its category.
                </div>`;
            } else {
              const weightItems = activeCats.map(cat => `
                <div style="display:grid;grid-template-columns:1fr 56px 16px;align-items:center;gap:5px;padding:4px 0;">
                  <span style="font-size:11px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cat}</span>
                  <input type="number" class="ideal-wt-inp" data-cat="${cat}" min="0" max="100" step="1" value="${weights[cat]}"
                    style="background:var(--input-bg,rgba(255,255,255,0.06));border:1px solid var(--line);border-radius:5px;color:var(--txt);
                           font-family:'Roboto Mono',monospace;font-size:11px;text-align:right;padding:3px 6px;width:100%"/>
                  <span style="font-size:10px;color:var(--dim)">%</span>
                </div>`).join("");

              editorEl.innerHTML = `
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:var(--dim);margin-bottom:7px">Target Equity Split</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px;">${weightItems}</div>
                <div style="text-align:right;font-size:10px;margin-top:5px;color:${weightOk ? "var(--mint)" : "var(--coral)"};">
                  Total: ${totalWeight.toFixed(0)}% ${weightOk ? "✓" : "— must equal 100%"}
                </div>`;
            }

            editorEl.querySelectorAll(".ideal-wt-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                if (!state.idealWeights) state.idealWeights = {};
                state.idealWeights[e.target.dataset.cat] = parseFloat(e.target.value) || 0;
                saveState();
                renderIdealAlloc();
              });
            });

            // --- Calculations ---
            const deployable = LIQ_FUNDS.reduce((s, f) => {
              const ls = state.liquid[f.id];
              return s + Math.max(0, (ls?.value || 0) - (ls?.reserve || 0));
            }, 0);
            const eqCurrent = EQ_FUNDS.reduce((s, f) => s + (state.equity[f.id]?.shown || 0), 0);
            const eqAfter   = eqCurrent + deployable;

            if (eqAfter === 0) {
              if (bar1El) bar1El.innerHTML = "";
              if (bar2El) bar2El.innerHTML = "";
              if (bar3El) bar3El.innerHTML = "";
              return;
            }

            // Group equity funds by category
            const catGroups = {};
            EQ_FUNDS.forEach(f => {
              const cat = state.equity[f.id]?.category || "";
              const key = cat || "__uncat__";
              if (!catGroups[key]) catGroups[key] = [];
              catGroups[key].push({ id: f.id, name: state.equity[f.id]?.name || f.defaultName, current: state.equity[f.id]?.shown || 0, cat });
            });

            let colorIdx = 0;
            const fundTargets = [];

            // Process categorized funds first (in EQ_CATEGORIES order)
            EQ_CATEGORIES.forEach(cat => {
              const funds = catGroups[cat];
              if (!funds?.length) return;
              const catWt = weights[cat] || 0;
              const catIdeal = eqAfter * catWt / 100;
              const catCurTotal = funds.reduce((s, f) => s + f.current, 0);
              funds.forEach(f => {
                const share = catCurTotal > 0 ? f.current / catCurTotal : 1 / funds.length;
                const idealAmt = catIdeal * share;
                fundTargets.push({
                  ...f, catWt,
                  idealAmt,
                  idealPct: eqAfter > 0 ? (idealAmt / eqAfter * 100) : 0,
                  toAdd: idealAmt - f.current,
                  fromLiq: deployable > 0 ? Math.max(0, deployable * (catWt / 100) * share) : 0,
                  color: ALLOC_PALETTE[colorIdx++ % ALLOC_PALETTE.length],
                });
              });
            });

            // Uncategorized funds — distribute remaining deployable proportionally
            const uncatFunds = catGroups["__uncat__"] || [];
            if (uncatFunds.length) {
              const assignedLiq = fundTargets.reduce((s, f) => s + f.fromLiq, 0);
              const remainingLiq = Math.max(0, deployable - assignedLiq);
              const uncatCurTotal = uncatFunds.reduce((s, f) => s + f.current, 0);
              // Ideal amount: remaining equity share split proportionally to current
              const remainingIdealEq = eqAfter - fundTargets.reduce((s, f) => s + f.idealAmt, 0);
              uncatFunds.forEach(f => {
                const share = uncatCurTotal > 0 ? f.current / uncatCurTotal : 1 / uncatFunds.length;
                const idealAmt = remainingIdealEq * share;
                const fromLiq  = remainingLiq * share;
                fundTargets.push({
                  ...f, catWt: 0,
                  idealAmt,
                  idealPct: eqAfter > 0 ? (idealAmt / eqAfter * 100) : 0,
                  toAdd: idealAmt - f.current,
                  fromLiq: deployable > 0 ? Math.max(0, fromLiq) : 0,
                  color: ALLOC_PALETTE[colorIdx++ % ALLOC_PALETTE.length],
                });
              });
            }

            if (!fundTargets.length) {
              if (bar1El) bar1El.innerHTML = `<div style="font-size:11px;color:var(--dim);margin-top:10px;">No equity funds with values entered.</div>`;
              if (bar2El) bar2El.innerHTML = "";
              if (bar3El) bar3El.innerHTML = "";
              return;
            }

            const mkSeg = (pct, color, title) => {
              if (pct < 0.5) return "";
              return `<div style="flex:${pct.toFixed(2)};background:${color};min-width:2px;height:100%;
                                   display:flex;align-items:center;justify-content:center;overflow:hidden;" title="${title}">
                ${pct >= 8 ? `<span style="font-size:9px;font-weight:700;color:#0a0f0e;padding:0 2px;">${Math.round(pct)}%</span>` : ""}
              </div>`;
            };

            // Shared shell for the three sub-sections below (Ideal Allocation,
            // Move Liquid→Equity, After Rebalancing) — keeps their heading
            // style in sync with the rest of the app's `.sec-head` sections
            // instead of three near-identical hand-rolled header blocks.
            const barSectionHtml = (title, color, totalText, segsHtml, rowsHtml) => `
              <div class="sec-head mt">
                ${title} &nbsp;— &nbsp;<span style="font-family:'Roboto Mono',monospace;color:${color}">${totalText}</span>
              </div>
              <div class="alloc-seg-bar" style="display:flex;height:28px;border-radius:7px;overflow:hidden;gap:1px;">${segsHtml}</div>
              <div>${rowsHtml}</div>`;

            // --- Bar 1: Ideal Allocation ---
            const bar1Segs = fundTargets.map(f =>
              mkSeg(f.idealPct, f.color, `${f.name}: ${fmt(Math.round(f.idealAmt))}`)).join("");

            const bar1Rows = fundTargets.map(f => `
              <div style="display:grid;grid-template-columns:10px 1fr auto auto auto;align-items:start;gap:6px;padding:6px 0;border-bottom:1px solid var(--line);">
                <span style="width:10px;height:10px;border-radius:2px;background:${f.color};display:block;margin-top:2px;flex-shrink:0"></span>
                <div style="overflow:hidden;">
                  <div style="font-size:11px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</div>
                  ${f.cat
                    ? `<div style="font-size:9px;color:var(--dim)">${f.cat}</div>`
                    : `<div style="font-size:9px;color:var(--coral)">No category — set on Portfolio tab</div>`}
                </div>
                <div style="text-align:right;min-width:58px">
                  <div style="font-size:8px;color:var(--dim);margin-bottom:1px">Current</div>
                  <div style="font-family:'Roboto Mono',monospace;font-size:10px;color:var(--txt)">${fmt(Math.round(f.current))}</div>
                </div>
                <div style="text-align:right;min-width:58px">
                  <div style="font-size:8px;color:var(--dim);margin-bottom:1px">${f.toAdd >= 0 ? "To Add" : "Excess"}</div>
                  <div style="font-family:'Roboto Mono',monospace;font-size:10px;color:${f.toAdd >= 0 ? "var(--mint)" : "var(--coral)"}">
                    ${f.toAdd >= 0 ? "+" : ""}${fmt(Math.round(Math.abs(f.toAdd)))}
                  </div>
                </div>
                <div style="text-align:right;min-width:38px">
                  <div style="font-size:8px;color:var(--dim);margin-bottom:1px">Weight</div>
                  <div style="font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;color:${f.color}">${f.idealPct.toFixed(1)}%</div>
                </div>
              </div>`).join("");

            if (bar1El) {
              bar1El.innerHTML = barSectionHtml("Ideal Equity Allocation", "var(--mint)", fmt(Math.round(eqAfter)), bar1Segs, bar1Rows);
              if (_animOnRender && !editMode)
                bar1El.querySelectorAll(".alloc-seg-bar").forEach(bar => animateWidth(bar, 100, 1000));
            }

            // --- Bar 2: Liquid → Equity redistribution ---
            if (bar2El) {
              if (deployable > 1) {
                const moveItems = fundTargets.filter(f => f.fromLiq > 1);
                const moveTotal = moveItems.reduce((s, f) => s + f.fromLiq, 0);
                const bar2Segs = moveItems.map(f => {
                  const pct = moveTotal > 0 ? (f.fromLiq / moveTotal * 100) : 0;
                  return mkSeg(pct, f.color, `${f.name}: ${fmt(Math.round(f.fromLiq))}`);
                }).join("");
                const bar2Rows = moveItems.map(f => {
                  const pct = moveTotal > 0 ? (f.fromLiq / moveTotal * 100) : 0;
                  return `<div style="display:grid;grid-template-columns:10px 1fr auto auto;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--line);">
                    <span style="width:10px;height:10px;border-radius:2px;background:${f.color};display:block;flex-shrink:0"></span>
                    <span style="font-size:11px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</span>
                    <span style="font-family:'Roboto Mono',monospace;font-size:11px;color:var(--liq);text-align:right;white-space:nowrap;">+${fmt(Math.round(f.fromLiq))}</span>
                    <span style="font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;color:${f.color};text-align:right;min-width:38px;">${pct.toFixed(1)}%</span>
                  </div>`;
                }).join("");
                bar2El.innerHTML = barSectionHtml("Move Liquid → Equity", "var(--liq)", fmt(Math.round(deployable)), bar2Segs, bar2Rows);
                if (_animOnRender && !editMode)
                  bar2El.querySelectorAll(".alloc-seg-bar").forEach(bar => animateWidth(bar, 100, 1000));
              } else {
                bar2El.innerHTML = `<div style="font-size:11px;color:var(--mint);margin-top:10px;">✓ No deployable liquid to redistribute.</div>`;
              }
            }

            // --- Bar 3: Portfolio After Rebalancing (all funds, post-move) ---
            if (bar3El) {
              // Equity funds: current + their fromLiq portion
              const eqAfterItems = fundTargets.map(f => ({
                name: f.name, afterVal: f.current + f.fromLiq, color: f.color, isLiq: false,
              }));
              // Liquid funds: what remains after deploying (= reserve, capped at value)
              let liqColorIdx = fundTargets.length;
              const liqAfterItems = LIQ_FUNDS.map(f => {
                const ls = state.liquid[f.id];
                const val = ls?.value || 0;
                const dep = Math.max(0, val - (ls?.reserve || 0));
                const afterVal = val - dep;
                return afterVal > 1 ? { name: ls?.name || f.defaultName, afterVal, color: ALLOC_PALETTE[liqColorIdx++ % ALLOC_PALETTE.length], isLiq: true } : null;
              }).filter(Boolean);

              const allAfter = [...eqAfterItems, ...liqAfterItems].sort((a, b) => b.afterVal - a.afterVal);
              const grandTotal = allAfter.reduce((s, f) => s + f.afterVal, 0);

              if (grandTotal > 0) {
                const bar3Segs = allAfter.map(f => {
                  const pct = (f.afterVal / grandTotal) * 100;
                  return mkSeg(pct, f.color, `${f.name}: ${fmt(Math.round(f.afterVal))}`);
                }).join("");
                const bar3Rows = allAfter.map(f => {
                  const pct = ((f.afterVal / grandTotal) * 100).toFixed(1);
                  return `<div style="display:grid;grid-template-columns:10px 1fr auto auto;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--line);">
                    <span style="width:10px;height:10px;border-radius:2px;background:${f.color};display:block;flex-shrink:0"></span>
                    <div>
                      <div style="font-size:11px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</div>
                      ${f.isLiq ? `<div style="font-size:9px;color:var(--dim)">liquid (reserved)</div>` : ""}
                    </div>
                    <span style="font-family:'Roboto Mono',monospace;font-size:11px;color:var(--txt);text-align:right;white-space:nowrap;">${fmt(Math.round(f.afterVal))}</span>
                    <span style="font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;color:${f.color};text-align:right;min-width:38px;">${pct}%</span>
                  </div>`;
                }).join("");
                bar3El.innerHTML = barSectionHtml("Portfolio After Rebalancing", "var(--txt)", fmt(Math.round(grandTotal)), bar3Segs, bar3Rows);
                if (_animOnRender && !editMode)
                  bar3El.querySelectorAll(".alloc-seg-bar").forEach(bar => animateWidth(bar, 100, 1000));
              } else {
                bar3El.innerHTML = "";
              }
            }
          }
