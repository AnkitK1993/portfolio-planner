import { ALLOC_PALETTE } from "../portfolio/allocation.js";
import { EQ_CATEGORIES } from "../../core/constants.js";
import { EQ_FUNDS, LIQ_FUNDS, defaultRebSections, deployable, editMode, saveState, state } from "../../core/state.js";
import { _animOnRender, animateWidth } from "../../core/animate.js";
import { el } from "../../core/dom.js";
import { refreshAncestorCollapsible } from "../../core/collapsible.js";
import { fmt, fmtCompact, pct } from "../../core/format.js";
import { addRebalanceRow, addRebalanceSection, deleteRebalanceRow, deleteRebalanceSection, setIdealFundWeight, setIdealWeight, setRebalanceRowName, setRebalanceRowValue, setRebalanceSectionName } from "../../store/actions.js";

export let rebEditMode = false;

// Which categories' Target Equity Split rows are expanded to show their
// individual funds — only categories with 2+ equity funds ever get the
// expand affordance at all. View-only UI state, not persisted, same
// treatment as nwHistExpanded/rebEditMode elsewhere in the app.
const expandedIdealCats = new Set();

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
            const wrap = el("planningRebalanceBody");
            if (!wrap) return;
            if (!state.rebalance?.sections) state.rebalance = { sections: defaultRebSections() };
            const secs = state.rebalance.sections;
            const em = rebEditMode;

            // No back button or page title here — this renders inline into
            // the Planning tab's own collapsible "Rebalance" card, whose
            // header already shows the title; the only thing this toolbar
            // needs is the Edit toggle (structural add/remove-row edits
            // warrant their own toggle, separate from the app's blanket
            // Edit mode).
            let html = `<div class="reb-page-head" style="justify-content:flex-end;">
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

            el("rebEditToggle").addEventListener("click", () => {
              rebEditMode = !rebEditMode;
              renderRebalance();
            });

            // Section name edits
            wrap.querySelectorAll(".reb-section-name-inp").forEach(inp => {
              inp.addEventListener("input", () => {
                const si = +inp.dataset.si;
                setRebalanceSectionName(si, inp.value);
                saveState();
              });
            });

            // Row name edits
            wrap.querySelectorAll(".reb-label-inp").forEach(inp => {
              inp.addEventListener("input", () => {
                const si = +inp.dataset.si, ri = +inp.dataset.ri;
                setRebalanceRowName(si, ri, inp.value);
                saveState();
              });
            });

            // MM / Real value inputs
            wrap.querySelectorAll(".reb-inp").forEach(inp => {
              inp.addEventListener("input", () => {
                const si = +inp.dataset.si, ri = +inp.dataset.ri, col = inp.dataset.col;
                setRebalanceRowValue(si, ri, col, parseFloat(inp.value) || 0);
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
                deleteRebalanceRow(si, ri);
                saveState();
                renderRebalance();
              });
            });

            // Delete section buttons
            wrap.querySelectorAll("[data-del-sec]").forEach(btn => {
              btn.addEventListener("click", () => {
                const si = +btn.dataset.delSec;
                deleteRebalanceSection(si);
                saveState();
                renderRebalance();
              });
            });

            // Add row buttons
            wrap.querySelectorAll(".reb-add-row-btn").forEach(btn => {
              btn.addEventListener("click", () => {
                const si = +btn.dataset.si;
                addRebalanceRow(si, { id: rebUid(), name: "New", mm: 0, real: 0 });
                saveState();
                renderRebalance();
              });
            });

            // Add section button
            el("rebAddSec")?.addEventListener("click", () => {
              addRebalanceSection({ id: rebSuid(), name: "New Section", rows: [{ id: rebUid(), name: "Total", mm: 0, real: 0 }] });
              saveState();
              renderRebalance();
            });
          }

export function renderIdealAlloc() {
            const editorEl = el("idealWeightsEditor");
            const bar1El   = el("idealAllocBarSection");
            const bar2El   = el("rebalMoveSection");
            const bar3El   = el("afterRebalBarSection");
            const actionsCard    = el("sumRebalActionsCard");
            const actionsSection = el("rebalActionsSection");
            const actionsPreview = el("sumRebalActionsPreview");
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

            // Group equity funds by category — needed both by the weight
            // editor below (to know which categories are worth expanding)
            // and by the ideal-amount math further down.
            const catGroups = {};
            EQ_FUNDS.forEach(f => {
              const cat = state.equity[f.id]?.category || "";
              const key = cat || "__uncat__";
              if (!catGroups[key]) catGroups[key] = [];
              catGroups[key].push({ id: f.id, name: state.equity[f.id]?.name || f.defaultName, current: state.equity[f.id]?.shown || 0, cat });
            });

            // Within-category fund split — only meaningful once a category
            // has 2+ funds (a single fund trivially gets its category's
            // whole weight). Each fund's weight is a percentage of the
            // WHOLE PORTFOLIO (same scale as the category weights above),
            // not a share of the category — so a category's own funds are
            // expected to sum to that category's weight, not to 100.
            // Defaults to each fund's current share of the category,
            // scaled by the category's weight, so expanding one for the
            // first time doesn't jump the numbers; fully overridable per
            // fund via idealFundWeights once the user types a value.
            const fundWeightsByCat = {};
            EQ_CATEGORIES.forEach(cat => {
              const funds = catGroups[cat];
              if (!funds || funds.length < 2) return;
              const catWt = weights[cat] || 0;
              const catCurTotal = funds.reduce((s, f) => s + f.current, 0);
              const wts = {};
              funds.forEach(f => {
                const curShare = catCurTotal > 0 ? (f.current / catCurTotal) : (1 / funds.length);
                wts[f.id] = state.idealFundWeights?.[f.id] !== undefined
                  ? state.idealFundWeights[f.id]
                  : Math.round(curShare * catWt);
              });
              fundWeightsByCat[cat] = wts;
            });

            // --- Editable weights section ---
            if (activeCats.length === 0) {
              editorEl.innerHTML = `
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:var(--dim);margin-bottom:7px">Target Equity Split</div>
                <div style="font-size:11px;color:var(--dim);padding:8px 0;">
                  No categories assigned. Go to the <b style="color:var(--txt)">Portfolio tab</b> → edit each equity fund → set its category.
                </div>`;
            } else {
              const weightItems = activeCats.map(cat => {
                const funds = catGroups[cat] || [];
                const expandable = funds.length > 1;
                const isOpen = expandable && expandedIdealCats.has(cat);
                const catWtForRow = weights[cat] || 0;
                const catFundWts = fundWeightsByCat[cat];
                const fundWtTotal = expandable ? funds.reduce((s, f) => s + (catFundWts[f.id] || 0), 0) : 0;
                const fundWtOk = Math.abs(fundWtTotal - catWtForRow) < 0.5;

                const subRowsHtml = isOpen ? `
                  <div style="padding:2px 0 10px 15px;">
                    ${funds.map(f => `
                      <div style="display:grid;grid-template-columns:1fr 56px 16px;align-items:center;gap:5px;padding:3px 0;">
                        <span style="font-size:10.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</span>
                        <input type="number" class="ideal-fund-wt-inp" data-fund="${f.id}" min="0" max="100" step="1" value="${catFundWts[f.id]}" ${editMode ? "" : "readonly"}
                          style="background:var(--input-bg,rgba(255,255,255,0.06));border:1px solid var(--line);border-radius:5px;color:${editMode ? "var(--txt)" : "var(--dim)"};
                                 font-family:'Roboto Mono',monospace;font-size:10.5px;text-align:right;padding:2px 6px;width:100%;${editMode ? "" : "cursor:default;"}"/>
                        <span style="font-size:9px;color:var(--dim)">%</span>
                      </div>`).join("")}
                    <div style="text-align:right;font-size:9px;margin-top:3px;color:${fundWtOk ? "var(--mint)" : "var(--coral)"};">
                      Of portfolio: ${fundWtTotal.toFixed(0)}% ${fundWtOk ? "✓" : `— must equal ${catWtForRow}% (${cat}'s own target)`}
                    </div>
                  </div>` : "";

                return `
                  <div style="display:grid;grid-template-columns:1fr 56px 16px;align-items:center;gap:5px;padding:4px 0;">
                    <span class="${expandable ? "ideal-cat-toggle" : ""}" data-cat="${cat}" style="font-size:11px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${expandable ? "cursor:pointer;" : ""}">
                      ${expandable ? `<span style="display:inline-block;width:10px;font-size:8px;color:var(--dim);">${isOpen ? "▾" : "▸"}</span>` : ""}${cat}
                    </span>
                    <input type="number" class="ideal-wt-inp" data-cat="${cat}" min="0" max="100" step="1" value="${weights[cat]}" ${editMode ? "" : "readonly"}
                      style="background:var(--input-bg,rgba(255,255,255,0.06));border:1px solid var(--line);border-radius:5px;color:${editMode ? "var(--txt)" : "var(--dim)"};
                             font-family:'Roboto Mono',monospace;font-size:11px;text-align:right;padding:3px 6px;width:100%;${editMode ? "" : "cursor:default;"}"/>
                    <span style="font-size:10px;color:var(--dim)">%</span>
                  </div>
                  ${subRowsHtml}`;
              }).join("");

              editorEl.innerHTML = `
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:var(--dim);margin-bottom:7px">
                  Target Equity Split ${editMode ? "" : `<span style="font-weight:400;text-transform:none;letter-spacing:normal;">— tap Edit to change</span>`}
                </div>
                <div style="display:flex;flex-direction:column;">${weightItems}</div>
                <div style="text-align:right;font-size:10px;margin-top:5px;color:${weightOk ? "var(--mint)" : "var(--coral)"};">
                  Total: ${totalWeight.toFixed(0)}% ${weightOk ? "✓" : "— must equal 100%"}
                </div>`;
            }

            editorEl.querySelectorAll(".ideal-cat-toggle").forEach(labelEl => {
              labelEl.addEventListener("click", () => {
                const cat = labelEl.dataset.cat;
                if (expandedIdealCats.has(cat)) expandedIdealCats.delete(cat);
                else expandedIdealCats.add(cat);
                renderIdealAlloc();
              });
            });

            editorEl.querySelectorAll(".ideal-wt-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                // readonly blocks typing but not every browser's number-input
                // spinner/scroll-wheel, so re-check editMode before writing.
                if (!editMode) { renderIdealAlloc(); return; }
                setIdealWeight(e.target.dataset.cat, parseFloat(e.target.value) || 0);
                saveState();
                renderIdealAlloc();
              });
            });

            editorEl.querySelectorAll(".ideal-fund-wt-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                if (!editMode) { renderIdealAlloc(); return; }
                setIdealFundWeight(e.target.dataset.fund, parseFloat(e.target.value) || 0);
                saveState();
                renderIdealAlloc();
              });
            });

            // Expanding/collapsing a category changes this section's height
            // without changing the card's OWN size, which ResizeObserver
            // doesn't catch on its own — see refreshAncestorCollapsible().
            refreshAncestorCollapsible(editorEl);

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
              if (actionsCard) actionsCard.style.display = "none";
              return;
            }

            let colorIdx = 0;
            const fundTargets = [];

            // Process categorized funds first (in EQ_CATEGORIES order). Each
            // fund's weight (fundWt) is already a whole-portfolio
            // percentage — see fundWeightsByCat above — so it drives
            // idealAmt directly rather than being scaled by catIdeal. A
            // single-fund category has no per-fund entry at all, so it
            // simply inherits the category's own weight wholesale.
            EQ_CATEGORIES.forEach(cat => {
              const funds = catGroups[cat];
              if (!funds?.length) return;
              const catWt = weights[cat] || 0;
              const catFundWts = fundWeightsByCat[cat]; // undefined when the category has just 1 fund
              funds.forEach(f => {
                const fundWt = catFundWts ? (catFundWts[f.id] || 0) : catWt;
                const idealAmt = eqAfter * fundWt / 100;
                fundTargets.push({
                  ...f, catWt,
                  idealAmt,
                  idealPct: eqAfter > 0 ? (idealAmt / eqAfter * 100) : 0,
                  toAdd: idealAmt - f.current,
                  fromLiq: deployable > 0 ? Math.max(0, deployable * fundWt / 100) : 0,
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
              if (actionsCard) actionsCard.style.display = "none";
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

            // --- Concrete sell/buy reallocation pairs ---
            // Bar 2 below only ever deploys NEW liquid cash toward
            // under-weighted funds — it has nothing to say when a fund is
            // simply over-weighted with no fresh cash involved (drift from
            // uneven growth, not new investing). This greedily pairs each
            // over-weight fund's excess against under-weight funds' need,
            // largest-first, so "drift exists" becomes an actual "sell ₹X
            // from A, buy ₹X into B" instruction. A materiality floor (0.5%
            // of the post-rebalance equity total, or ₹500, whichever is
            // larger) keeps rounding-level noise from generating a
            // pointless ₹40 "rebalance" suggestion.
            const MATERIALITY = Math.max(500, eqAfter * 0.005);
            const overQ  = fundTargets.filter(f => f.toAdd < -MATERIALITY)
              .map(f => ({ name: f.name, color: f.color, remaining: -f.toAdd }))
              .sort((a, b) => b.remaining - a.remaining);
            const underQ = fundTargets.filter(f => f.toAdd > MATERIALITY)
              .map(f => ({ name: f.name, color: f.color, remaining: f.toAdd }))
              .sort((a, b) => b.remaining - a.remaining);
            const transfers = [];
            let oi = 0, ui = 0;
            while (oi < overQ.length && ui < underQ.length) {
              const amt = Math.min(overQ[oi].remaining, underQ[ui].remaining);
              if (amt > MATERIALITY) transfers.push({ from: overQ[oi], to: underQ[ui], amount: amt });
              overQ[oi].remaining  -= amt;
              underQ[ui].remaining -= amt;
              if (overQ[oi].remaining  <= MATERIALITY) oi++;
              if (underQ[ui].remaining <= MATERIALITY) ui++;
            }
            const transfersHtml = transfers.length
              ? `<div>${transfers.map(t => `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);font-size:11px;">
                      <span style="width:8px;height:8px;border-radius:2px;background:${t.from.color};flex-shrink:0;"></span>
                      <span style="color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.from.name}</span>
                      <span style="color:var(--dim);flex-shrink:0;">&rarr;</span>
                      <span style="width:8px;height:8px;border-radius:2px;background:${t.to.color};flex-shrink:0;"></span>
                      <span style="color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${t.to.name}</span>
                      <span style="font-family:'Roboto Mono',monospace;color:var(--amber);white-space:nowrap;">${fmt(Math.round(t.amount))}</span>
                    </div>`).join("")}</div>`
              : `<div style="font-size:11px;color:var(--mint);padding:6px 0;">✓ Already within target allocation — no rebalancing moves needed.</div>`;

            if (bar1El) {
              bar1El.innerHTML = barSectionHtml("Ideal Equity Allocation", "var(--mint)", fmt(Math.round(eqAfter)), bar1Segs, bar1Rows);
              if (_animOnRender && !editMode)
                bar1El.querySelectorAll(".alloc-seg-bar").forEach(bar => animateWidth(bar, 100, 1000));
            }
            if (actionsCard) actionsCard.style.display = "";
            if (actionsSection) actionsSection.innerHTML = transfersHtml;
            if (actionsPreview) actionsPreview.textContent = transfers.length ? `${transfers.length} move${transfers.length !== 1 ? "s" : ""}` : "Balanced ✓";

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

            // --- Bar 3: Portfolio After Rebalancing (equity funds only,
            // post-move) --- deliberately excludes leftover/reserved
            // liquid balances — this bar is about how equity itself is
            // split after rebalancing, not a full net-worth breakdown,
            // and reserved liquid cash isn't part of that split. ---
            if (bar3El) {
              const eqAfterItems = fundTargets.map(f => ({
                name: f.name, afterVal: f.current + f.fromLiq, color: f.color,
              })).sort((a, b) => b.afterVal - a.afterVal);
              const grandTotal = eqAfterItems.reduce((s, f) => s + f.afterVal, 0);

              if (grandTotal > 0) {
                const bar3Segs = eqAfterItems.map(f => {
                  const pct = (f.afterVal / grandTotal) * 100;
                  return mkSeg(pct, f.color, `${f.name}: ${fmt(Math.round(f.afterVal))}`);
                }).join("");
                const bar3Rows = eqAfterItems.map(f => {
                  const pct = ((f.afterVal / grandTotal) * 100).toFixed(1);
                  return `<div style="display:grid;grid-template-columns:10px 1fr auto auto;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--line);">
                    <span style="width:10px;height:10px;border-radius:2px;background:${f.color};display:block;flex-shrink:0"></span>
                    <div style="font-size:11px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</div>
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

export let investEditMode = false;

// Invest New Money (Planning tab) — put a hypothetical amount into one
// or more equity funds (its own Edit/Done toggle, independent of the
// app's blanket Edit mode, same convention as Rebalance's own
// rebEditMode) and see the invested total plus how each fund's
// allocation % shifts. Every equity fund is listed regardless of
// category — this card no longer recommends a split, just shows the
// effect of whatever you type. Current % is each fund's share of
// today's actual equity total; New % is its share of that total plus
// everything drafted across every fund (so money added to one fund
// correctly dilutes the others' percentages too).
//
// Drafts live in state.investDrafts (still just a "what if" scratch
// figure — no transaction is created, fund balances are never touched)
// but are written to the database once the user taps "Done", so the
// plan survives a refresh or reopening on another device. Typing itself
// only updates the in-memory state — see the Done-toggle listener below
// for the actual saveState() call.
export function renderInvestNewMoney() {
            const wrap = el("investNewMoneyBody");
            if (!wrap) return;
            if (!state.investDrafts) state.investDrafts = {};
            const investDrafts = state.investDrafts;

            const funds = EQ_FUNDS.map(f => ({
              id: f.id,
              name: state.equity[f.id]?.name || f.defaultName,
              cat: state.equity[f.id]?.category || "",
              current: state.equity[f.id]?.shown || 0,
            }));
            // A fund removed on the Portfolio tab shouldn't leave a ghost
            // draft behind still counting toward the invested total.
            Object.keys(investDrafts).forEach(id => { if (!funds.some(f => f.id === id)) delete investDrafts[id]; });

            if (!funds.length) {
              wrap.innerHTML = `<div style="font-size:11px;color:var(--dim);padding:8px 0;">No equity funds yet — add one on the Portfolio tab.</div>`;
              return;
            }

            // --- Target % per fund — mirrors renderIdealAlloc's own
            // category/fund-weight math (deliberately duplicated rather
            // than shared, same tradeoff as elsewhere in this file) so
            // each row can show what its "ideal" share of equity is,
            // right alongside current/new. A fund with no category
            // assigned has no defined target.
            if (!state.idealWeights) state.idealWeights = {};
            const DEF_WEIGHTS = { "Large Cap": 45, "Flexi Cap": 33, "Mid Cap": 22 };
            const catWeights = {};
            EQ_CATEGORIES.forEach(cat => {
              catWeights[cat] = state.idealWeights[cat] !== undefined ? state.idealWeights[cat] : (DEF_WEIGHTS[cat] || 0);
            });
            const catGroups = {};
            funds.forEach(f => {
              const key = f.cat || "__uncat__";
              (catGroups[key] = catGroups[key] || []).push(f);
            });
            const fundWeightsByCat = {};
            EQ_CATEGORIES.forEach(cat => {
              const catFunds = catGroups[cat];
              if (!catFunds || catFunds.length < 2) return;
              const catWt = catWeights[cat] || 0;
              const catCurTotal = catFunds.reduce((s, f) => s + f.current, 0);
              const wts = {};
              catFunds.forEach(f => {
                const curShare = catCurTotal > 0 ? (f.current / catCurTotal) : (1 / catFunds.length);
                wts[f.id] = state.idealFundWeights?.[f.id] !== undefined ? state.idealFundWeights[f.id] : Math.round(curShare * catWt);
              });
              fundWeightsByCat[cat] = wts;
            });
            const targetPctById = {};
            funds.forEach(f => {
              if (!f.cat || !catGroups[f.cat]) { targetPctById[f.id] = null; return; }
              const catFunds = catGroups[f.cat];
              targetPctById[f.id] = catFunds.length > 1 ? (fundWeightsByCat[f.cat]?.[f.id] || 0) : (catWeights[f.cat] || 0);
            });

            const em = investEditMode;
            const eqCurrent = funds.reduce((s, f) => s + f.current, 0);
            const totalInvested = funds.reduce((s, f) => s + Math.max(0, investDrafts[f.id] || 0), 0);
            const eqNew = eqCurrent + totalInvested;

            const rows = funds.map(f => {
              const draft = Math.max(0, investDrafts[f.id] || 0);
              const curPct = eqCurrent > 0 ? (f.current / eqCurrent * 100) : 0;
              const newVal = f.current + draft;
              const newPct = eqNew > 0 ? (newVal / eqNew * 100) : 0;
              const delta = newPct - curPct;
              const deltaColor = delta > 0.05 ? "var(--mint)" : delta < -0.05 ? "var(--coral)" : "var(--dim)";
              const deltaArrow = delta > 0.05 ? "▲" : delta < -0.05 ? "▼" : "";
              const targetPct = targetPctById[f.id];
              const tagText = [f.cat, targetPct !== null ? `Target ${targetPct.toFixed(0)}%` : "No target set"].filter(Boolean).join(" · ");

              return `
                <div style="padding:8px 0;border-bottom:1px solid var(--line);">
                  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
                    <span style="font-size:11.5px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</span>
                    <span style="font-size:9px;color:var(--dim);flex-shrink:0;white-space:nowrap;">${tagText}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:5px;">
                    <span style="font-size:10.5px;color:var(--dim);">
                      ${fmt(Math.round(f.current))} <span style="opacity:0.75;">(${curPct.toFixed(1)}%)</span>
                    </span>
                    ${em ? `
                    <div class="ibox" style="flex:0 0 112px;">
                      <span class="pfx">₹</span>
                      <input type="number" class="invest-fund-inp" data-fund="${f.id}" min="0" step="100" value="${draft || ""}" placeholder="0"
                        style="width:100%;background:var(--input-bg,rgba(255,255,255,0.06));border:1px solid var(--line);border-radius:5px;color:var(--txt);
                               font-family:'Roboto Mono',monospace;font-size:11px;text-align:right;padding:4px 6px;"/>
                    </div>` : ""}
                  </div>
                  ${!em && totalInvested > 0 ? `
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                    <span style="font-size:10px;color:var(--mint);">${draft > 0 ? `+${fmt(Math.round(draft))} invested` : ""}</span>
                    <span style="font-size:10.5px;font-weight:700;color:${deltaColor};">
                      ${fmt(Math.round(newVal))} (${newPct.toFixed(1)}%) ${deltaArrow}
                    </span>
                  </div>` : ""}
                </div>`;
            }).join("");

            wrap.innerHTML = `
              <div class="reb-page-head">
                <div style="flex:1;">
                  <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.6px;">Total Invested</div>
                  <div style="font-family:'Roboto Mono',monospace;font-size:18px;font-weight:700;color:var(--mint);">${fmt(Math.round(totalInvested))}</div>
                </div>
                <button class="reb-edit-btn${em ? " done" : ""}" id="investEditToggle">${em ? "Done" : "Edit"}</button>
              </div>
              <div>${rows}</div>`;

            el("investEditToggle").addEventListener("click", () => {
              const wasEditing = investEditMode;
              investEditMode = !investEditMode;
              // Tapping "Done" (leaving edit mode) is the save point —
              // typing itself never hits the database, only this does.
              if (wasEditing) saveState();
              renderInvestNewMoney();
            });

            wrap.querySelectorAll(".invest-fund-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                const v = Math.max(0, parseFloat(e.target.value) || 0);
                if (v > 0) investDrafts[e.target.dataset.fund] = v;
                else delete investDrafts[e.target.dataset.fund];
                renderInvestNewMoney();
              });
            });

            refreshAncestorCollapsible(wrap);
          }
