import { EQ_CATEGORIES } from "../../core/constants.js";
import { EQ_FUNDS, LIQ_FUNDS, editMode, fundName, normalizeSnap, saveState, state } from "../../core/state.js";
import { UI } from "../../core/ui.js";
import { open as openModal } from "../../core/modal.js";
import { _animOnRender, _animRaf, animateNumber, animateWidth } from "../../core/animate.js";
import { arcPath } from "../../core/arcGauge.js";
import { renderItemList } from "../../core/itemList.js";
import { renderTrendChart } from "../../core/trendChart.js";
import { avgMonthlyGrowthRate, monthsToReach, nwTotal } from "../../domain/networth.js";
import { cachedPortfolioXirr, fundXirr, rollingPortfolioXirr } from "../../domain/xirr.js";
import { el } from "../../core/dom.js";
import { estimateCapitalGainsTax, LTCG_EXEMPTION } from "../../domain/tax.js";
import { fmt, fmtCompact, fmtMonth, pct } from "../../core/format.js";
import { averageExpenseBreakdown, averageIncome, EXPENSE_PERIODS, EXPENSE_CATEGORIES, fixedExpensesByCategory, monthlyExpenseSeries, monthlyIncomeSeries, normalizeExpenseCategory, resolvePeriodKeys, totalMonthlyExpenses } from "../../domain/expenses.js";
import { renderAllocBars, renderCompositionDonut } from "../portfolio/allocation.js";
import { renderIdealAlloc } from "./rebalance.js";

export function renderSummaryExtras(eqCur, liqCur, totCur, eqTgt, liqTgt, totTgt, nowEqPct, tgtEqPct) {
            /* — Health Score (also renders the drift alert banner) — */
            renderHealthScore();

            /* — Expenses (fixed items + auto bank-spend) — */
            renderExpenses();

            /* — Expense Trends (averages, projections, Income vs Expenses) — */
            renderExpenseTrends();

            /* — Financial Independence progress — */
            renderFireProgress();

            /* — Loans / EMIs (standalone tracker, not part of Net Worth) — */
            renderLoans();

            /* — Ideal Allocation card — */
            renderIdealAlloc();

            /* — Fund performance table — */
            renderFundTable();
            /* — Portfolio XIRR, Investment Streak, Returns Heatmap — */
            renderPortfolioXirr();
            renderInvestmentStreak();
            renderReturnsHeatmap();
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

            const t = estimateCapitalGainsTax({
              taxSlabPct: state.surplus?.taxSlabPct, eqFunds: EQ_FUNDS, liqFunds: LIQ_FUNDS,
              equity: state.equity, liquid: state.liquid, transactions: state.transactions,
            });
            if (!t.hasAnyHolding) { card.style.display = "none"; return; }
            card.style.display = "";
            const taxPreview = el("sumTaxPreview");
            if (taxPreview) taxPreview.textContent = fmt(t.totalTax);

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

// Pure calc: per-fund performance rows (liquid + equity) — split out from
// renderFundTable() the same way computeHealthScore() was split out from
// renderHealthScore() above, so the row-building logic is independently
// testable rather than re-derived as part of a template-building function.
function computeFundRows() {
            return [...LIQ_FUNDS.map(f => ({ f, isLiq: true })), ...EQ_FUNDS.map(f => ({ f, isLiq: false }))]
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
                  xirr: fundXirr(f.id, isLiq, s, state.transactions),
                };
              })
              .filter(r => r.invested > 0 || r.current > 0);
          }

// Pure calc: equity-only category rollup (Large/Flexi/Mid Cap, etc.) — only
// meaningful once there's more than one category to compare, so callers
// check catRows.length >= 2 before showing it. XIRR per category isn't a
// simple average of its funds' XIRRs — it's recomputed from that
// category's own pooled cash flows via cachedPortfolioXirr, same as the
// Portfolio total row does across every fund.
function computeCategoryRollup() {
            const catMap = {};
            EQ_FUNDS.forEach(f => {
              const s = state.equity[f.id];
              const invested = s?.paid || 0;
              const afterExp = s?.shown || 0;
              const current = s?.currentValue || afterExp;
              if (invested <= 0 && current <= 0) return;
              const cat = s?.category || "Uncategorized";
              if (!catMap[cat]) catMap[cat] = { cat, invested: 0, afterExp: 0, current: 0, fundIds: [] };
              catMap[cat].invested += invested;
              catMap[cat].afterExp += afterExp;
              catMap[cat].current += current;
              catMap[cat].fundIds.push(f.id);
            });
            const catOrder = c => { const i = EQ_CATEGORIES.indexOf(c); return i === -1 ? 999 : i; };
            return Object.values(catMap)
              .map(c => {
                const returns = c.afterExp > 0 ? c.current - c.afterExp : null;
                const returnsPct = c.afterExp > 0 ? pct(returns, c.afterExp) : null;
                const catTxns = (state.transactions || []).filter(t => c.fundIds.includes(t.fundId) && t.date && Number(t.afterExpense ?? t.invested) > 0);
                const xirr = (catTxns.length && c.current > 0) ? cachedPortfolioXirr(catTxns, c.current) : null;
                return { ...c, returns, returnsPct, xirr };
              })
              .sort((a, b) => catOrder(a.cat) - catOrder(b.cat));
          }

function renderFundTable() {
            const wrap = el("sumFundTable");
            if (!wrap) return;

            const rows = computeFundRows();

            if (!rows.length) {
              wrap.innerHTML = UI.emptyState("📊", "No fund data yet", "Add transactions and current values to see performance here.");
              const previewElEmpty = el("sumFundPreview");
              if (previewElEmpty) previewElEmpty.textContent = "";
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

            // Portfolio total — folds in the same XIRR shown on the
            // Portfolio XIRR card above, so the two never disagree. Also
            // doubles as the card's collapsed-state preview.
            const totalInvested = rows.reduce((s, r) => s + r.invested, 0);
            const totalAfterExp = rows.reduce((s, r) => s + (r.returns != null ? r.afterExp : 0), 0);
            const totalReturns = rows.reduce((s, r) => s + (r.returns || 0), 0);
            const totalReturnsPct = totalAfterExp > 0 ? pct(totalReturns, totalAfterExp) : null;
            const portfolioXirr = portfolioXirrSummary();

            const previewEl = el("sumFundPreview");
            if (previewEl) previewEl.textContent = fmtCompact(totalInvested) + " · " + signedCompact(totalReturns);

            let totalRowHtml = "";
            if (rows.length > 1) {
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

            // By Category (equity funds only — liquid funds have no
            // category) — only worth showing once there's more than one
            // category to actually compare; a single category duplicates
            // the Portfolio total row above.
            const catRows = computeCategoryRollup();

            const catRowsHtml = catRows.length >= 2 ? `
              <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);">
                <div style="font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">By Category</div>
                <div class="fperf-table">
                  <div class="fperf-row fperf-head">
                    <span style="font-family:'Roboto Mono',monospace;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--dim);">Category</span>
                    <span class="fperf-num" style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--dim);">Invested</span>
                    <span class="fperf-num" style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--dim);">Returns</span>
                    <span class="fperf-num" style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--dim);">Ret %</span>
                    <span class="fperf-num" style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--dim);">XIRR</span>
                  </div>
                  ${catRows.map(c => {
                    const retClass = c.returns == null ? "" : c.returns >= 0 ? "mint" : "coral";
                    const retTxt = c.returns == null ? "—" : signedCompact(c.returns);
                    const retPctTxt = c.returnsPct == null ? "—" : (c.returnsPct >= 0 ? "+" : "") + c.returnsPct.toFixed(2) + "%";
                    const xirrTxt = c.xirr == null ? "—" : (c.xirr * 100 >= 0 ? "+" : "") + (c.xirr * 100).toFixed(2) + "%";
                    const xirrClass = c.xirr == null ? "" : c.xirr >= 0 ? "mint" : "coral";
                    return `<div class="fperf-row">
                      <span class="fperf-name">${c.cat}</span>
                      <span class="fperf-num">${fmtCompact(c.invested)}</span>
                      <span class="fperf-num"${retClass ? ` style="color:var(--${retClass})"` : ""}>${retTxt}</span>
                      <span class="fperf-num"${retClass ? ` style="color:var(--${retClass})"` : ""}>${retPctTxt}</span>
                      <span class="fperf-num"${xirrClass ? ` style="color:var(--${xirrClass})"` : ""}>${xirrTxt}</span>
                    </div>`;
                  }).join("")}
                </div>
              </div>` : "";

            wrap.innerHTML = `<div class="fperf-table">
              <div class="fperf-row fperf-head">${headHtml}</div>
              ${rowsHtml}
              ${totalRowHtml}
            </div>
            ${catRowsHtml}`;

            wrap.querySelectorAll(".fperf-th").forEach(btn => {
              btn.addEventListener("click", () => {
                const col = btn.dataset.col;
                if (fundTableSort.col === col) fundTableSort.dir = fundTableSort.dir === "asc" ? "desc" : "asc";
                else fundTableSort = { col, dir: col === "name" ? "asc" : "desc" };
                renderFundTable();
              });
            });
          }

// Pure scoring logic behind the Health Score card — split out from
// renderHealthScore() so takeSnapshot() (features/networth/index.js) can
// stash today's total alongside a Net Worth snapshot without touching any
// DOM, building up the history renderHealthTrend() below reads back.
export function computeHealthScore() {
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
            const monthlyExp = totalMonthlyExpenses({
              fixedExpenses: state.surplus?.fixedExpenses, liqFunds: LIQ_FUNDS, eqFunds: EQ_FUNDS,
              liquid: state.liquid, equity: state.equity, networth: state.networth,
              transactions: state.transactions,
            }).total;
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

            return { cScore, cNote, aScore, aNote, bScore, bNote, rScore, rNote, total, grade, gc };
          }

function renderHealthScore() {
            const card = el("sumHealthCard");
            const wrap = el("sumHealthScore");
            if (!wrap) return;

            const { cScore, cNote, aScore, aNote, bScore, bNote, rScore, rNote, total, grade, gc } = computeHealthScore();

            // SVG arc gauge (225° start → sweeps clockwise 270° at 100%)
            const CX = 50, CY = 50, R = 36;
            const bgPath = arcPath(CX, CY, R, 225, 270);
            const fgSweep = Math.max(0, 270 * total / 100);
            const fgPath  = fgSweep > 1 ? arcPath(CX, CY, R, 225, fgSweep) : null;
            const fgArcLen = R * fgSweep * Math.PI / 180;

            const dims = [
              { label: "Consistency",  score: cScore, note: cNote, color: "var(--liq)",
                what: "How many consecutive months you've logged at least one investment, counting back from this month.",
                max: "Reach 25/25 with a 24+ month unbroken streak (20 pts at 12+ months, 15 at 6+, 10 at 3+, 5 at 1+)." },
              { label: "Allocation",   score: aScore, note: aNote, color: "var(--mint)",
                what: "How closely your current equity holdings match the ideal category weights you've set (Large/Flexi/Mid/Small Cap, on the Portfolio tab).",
                max: "Reach 25/25 by keeping your actual allocation within about 6% of target — every 1% of drift costs 0.8 points." },
              { label: "Liq. Buffer",  score: bScore, note: bNote, color: "var(--amber)",
                what: "Your deployable liquid fund balance (fund value minus any reserve you've earmarked) measured against your monthly expenses.",
                max: "Reach 25/25 by keeping at least 6 months of expenses covered in liquid funds (17 pts at 3+ months, 10 at 1+, 0 below 1)." },
              { label: "Returns",      score: rScore, note: rNote, color: "var(--purple)",
                what: "Your portfolio's annualised XIRR across every logged transaction — the actual return you're earning on your money.",
                max: "Reach 25/25 with an XIRR of 18%+ (20 pts at 12%+, 15 at 8%+, 8 at 0%+, 0 if negative)." },
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
                  ${dims.map((d, i) => `
                    <div class="phs-dim" data-i="${i}" style="cursor:pointer;">
                      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                        <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--dim)">${d.label} <span style="opacity:0.6;">ⓘ</span></span>
                        <span style="font-family:'Roboto Mono',monospace;font-size:10.5px;font-weight:700;color:${d.color}">${d.score}/25</span>
                      </div>
                      <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:3px;">
                        <div class="phs-dim-bar" data-w="${(d.score / 25 * 100).toFixed(0)}" style="height:100%;width:0%;background:${d.color};border-radius:3px;"></div>
                      </div>
                      <div style="font-size:10.5px;color:var(--dim)">${d.note}</div>
                    </div>`).join("")}
                </div>
              </div>`;

            if (card) card.style.display = "";

            wrap.querySelectorAll(".phs-dim").forEach(dimEl => {
              dimEl.addEventListener("click", (e) => {
                e.stopPropagation();
                const d = dims[+dimEl.dataset.i];
                openModal({
                  title: d.label,
                  size: "sm",
                  body: (target) => {
                    target.innerHTML = `
                      <p style="font-size:12px;color:var(--txt);line-height:1.5;">${d.what}</p>
                      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">
                        <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px;">How to reach 25/25</div>
                        <p style="font-size:12px;color:var(--txt);line-height:1.5;">${d.max}</p>
                      </div>`;
                  },
                  footer: [{ label: "Got it", variant: "primary" }],
                });
              });
            });

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

            renderHealthTrend();
          }

/* Health Score trend, underneath the gauge — unlike the XIRR trend above it
   (which can recompute past values purely from transaction history),
   Allocation drift and Liquidity Buffer both depend on point-in-time fund
   balances this app has never stored historically, so there's no sound way
   to reconstruct past scores. Instead, takeSnapshot() (features/networth/
   index.js) stashes that moment's computeHealthScore().total onto the
   snapshot itself going forward — this only ever plots snapshots that
   actually have one, so old pre-feature snapshots are silently skipped
   rather than showing a misleading 0. Fixed 0–100 y-axis (not auto-scaled
   like the XIRR trend) so a same-size move always reads as the same size
   move, regardless of how tightly the score has clustered recently. */
function renderHealthTrend() {
            const snaps = state.networth.snapshots || {};
            const points = Object.entries(snaps)
              .map(([key, v]) => ({ key, score: v.healthScore }))
              .filter(p => typeof p.score === "number")
              .sort((a, b) => a.key.localeCompare(b.key));

            renderTrendChart(el("sumHealthTrend"), el("sumHealthTrendHint"), points.map(p => p.score), {
              yDomain: [0, 100],
              colorFor: last => last >= 80 ? "var(--mint)" : last >= 60 ? "var(--mint-soft)" : last >= 40 ? "var(--amber)" : "var(--coral)",
            });
          }

// Expense Trends section state — view-only UI preferences (which period to
// look back over, which categories count toward the average), not
// persisted, same as rtnMode/txnFilter elsewhere in the app.
let expPeriod = "month";
let expIncludeFixed = true;
let expIncludeExtra = true;
let expIncludeSip = false;

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
            const { fixed, sip, surplusInvestment, planned, bankSpend, extra, total, isManual } = totalMonthlyExpenses({
              fixedExpenses: items, liqFunds: LIQ_FUNDS, eqFunds: EQ_FUNDS,
              liquid: state.liquid, equity: state.equity, networth: state.networth,
              transactions: state.transactions,
            });

            // Emergency fund buffer — moved here from the Health Score card
            // (still feeds that card's own "Liq. Buffer" score dimension via
            // the same totalMonthlyExpenses()/deployable-liquid inputs, just
            // displayed once, next to the expense total it's measured against).
            const totalLiqFree = LIQ_FUNDS.reduce((s, f) => s + Math.max(0, (state.liquid[f.id]?.value || 0) - (state.liquid[f.id]?.reserve || 0)), 0);
            const bufMonths = total > 0 ? totalLiqFree / total : null;

            // Income vs Expenses — a monthly cash-flow view, not a Net
            // Worth total, so it always uses the raw Income figure
            // directly rather than extraIncome() (which is 0 by design —
            // Income is assumed already reflected in Bank & Savings and
            // never double-counted into Net Worth).
            const incomeVal = state.networth.income || 0;
            const netCashFlow = incomeVal > 0 ? incomeVal - total : null;

            // Kept in sync regardless of collapsed/open state — this is
            // what's visible when the card is collapsed (the default).
            const collapsedTotalEl = el("expCollapsedTotal");
            if (collapsedTotalEl) collapsedTotalEl.textContent = fmt(total);

            const catBreakdown = fixedExpensesByCategory(items);
            const catBreakdownHtml = catBreakdown.length > 1
              ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
                  ${catBreakdown.map(c => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:9.5px;color:var(--dim);">
                    <span style="width:7px;height:7px;border-radius:50%;background:${c.color};display:inline-block;"></span>${c.label} ${fmt(c.total)}
                  </span>`).join("")}
                </div>`
              : "";

            // Fixed items + SIPs are both a BREAKDOWN of the bank drop
            // (SIPs auto-debit from the same account) — used only to work
            // out "extra", whatever of that drop neither accounts for (can
            // go negative: less left the account than was planned, e.g. a
            // bill or SIP hasn't hit yet). SIP itself is excluded from
            // Total This Month since it's an investment, not spend. A
            // month that actually invested more than the configured SIP
            // (Mutual Funds growing by more than planned) shows that
            // excess as its own "Surplus" segment rather than folding it
            // into "Extra" — it left the bank for investing, not spending.
            const segs = (bankSpend && extra >= 0)
              ? [
                  { label: "Fixed", value: fixed, color: "var(--mint)" },
                  { label: "SIP", value: sip, color: "var(--liq)" },
                  // Compact (e.g. "1.5L") rather than exact rupees — this is
                  // a one-off/variable top-up, not a precise budgeted figure
                  // like the others, so a rounded-off amount reads better.
                  { label: "Surplus", value: surplusInvestment, color: "#a78bfa", compact: true },
                  { label: "Extra", value: extra, color: "var(--amber)" },
                ].filter(s => s.value > 0)
              : [];
            const segBarHtml = segs.length
              ? `<div class="alloc-seg-bar" style="display:flex;height:10px;border-radius:6px;overflow:hidden;gap:1px;margin-top:12px;">
                  ${segs.map(s => `<div style="flex:${((s.value / bankSpend.amount) * 100).toFixed(2)};background:${s.color};min-width:2px;" title="${s.label}: ${s.compact ? fmtCompact(s.value) : fmt(s.value)}"></div>`).join("")}
                </div>
                <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:7px;">
                  ${segs.map(s => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:9.5px;color:var(--dim);">
                    <span style="width:7px;height:7px;border-radius:50%;background:${s.color};display:inline-block;"></span>${s.label} ${s.compact ? fmtCompact(s.value) : fmt(s.value)}
                  </span>`).join("")}
                </div>`
              : "";

            const bankHtml = bankSpend
              ? `<div class="exp-bank-block">
                  <div class="exp-bank-row">
                    <span>Bank balance this month</span>
                    <span class="exp-bank-fig">${fmt(bankSpend.openingBank)}<span class="exp-bank-arrow">&rarr;</span>${fmt(bankSpend.currentBank)}</span>
                  </div>
                  <div class="exp-bank-sub">As of ${fmtMonth(bankSpend.asOfKey)} snapshot vs. now on the Net Worth tab &mdash; a drop of ${fmt(bankSpend.amount)}</div>
                  ${segBarHtml}
                  <div class="exp-stat-grid" style="margin-top:12px;">
                    ${surplusInvestment > 0 ? `<div class="exp-stat-card"><div class="lbl">Surplus Investment</div><div class="val" style="color:#a78bfa">+${fmtCompact(surplusInvestment)}</div></div>` : ""}
                    <div class="exp-stat-card"><div class="lbl">${extra >= 0 ? "Extra Beyond Planned" : "Under Planned"}</div><div class="val" style="color:${extra > 0 ? "#fbbf24" : "#4ade80"}">${extra >= 0 ? "+" : "−"}${fmt(Math.abs(extra))}</div></div>
                  </div>
                </div>`
              : `<div class="exp-bank-block" style="font-size:10.5px;color:var(--dim);">
                  Save a Net Worth snapshot to start tracking bank spending automatically &mdash; until then, Total This Month is just your Fixed Total.
                </div>`;

            // wrap (unlike its children) is the same persistent DOM node
            // across every render — capturing focus against it, before
            // this function smashes its own innerHTML below, is what
            // lets renderItemList() restore focus correctly afterward.
            const hadFocusInside = wrap.contains(document.activeElement);

            wrap.innerHTML = `
              <div class="expenses-list-wrap"></div>
              <div class="exp-stat-grid">
                <div class="exp-stat-card"><div class="lbl">Fixed Total</div><div class="val">${fmt(fixed)}</div></div>
                <div class="exp-stat-card"><div class="lbl">Monthly SIP</div><div class="val">${fmt(sip)}</div></div>
                <div class="exp-stat-card"><div class="lbl">Planned Outflow</div><div class="val">${fmt(planned)}</div></div>
              </div>
              ${catBreakdownHtml}
              <div style="font-size:9px;color:var(--dim);opacity:0.8;">SIP total is set per-fund on the Portfolio tab</div>
              ${bankHtml}
              <div class="exp-hero">
                <div class="exp-hero-top">
                  <span class="exp-hero-lbl">Total This Month</span>
                  <span class="exp-hero-val">${fmt(total)}</span>
                </div>
                <div class="exp-hero-sub">${isManual ? "Manually entered above — overrides the Bank-based estimate" : "SIP excluded — it's an investment, not an expense"}</div>
              </div>
              ${netCashFlow !== null ? `
              <div class="exp-hero" style="margin-top:12px;">
                <div class="exp-hero-top">
                  <span class="exp-hero-lbl">Income vs Expenses</span>
                  <span class="exp-hero-val" style="color:${netCashFlow >= 0 ? "var(--mint)" : "var(--coral)"}">${netCashFlow >= 0 ? "+" : "−"}${fmt(Math.abs(netCashFlow))}</span>
                </div>
                <div class="exp-hero-sub">${fmt(incomeVal)} income &minus; ${fmt(total)} expenses this month</div>
              </div>` : ""}
              ${bufMonths !== null ? `
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--dim);">
                Emergency fund: <b style="color:${bufMonths >= 6 ? "var(--mint)" : bufMonths >= 3 ? "var(--amber)" : "var(--coral)"};font-family:'Roboto Mono',monospace">${bufMonths.toFixed(1)} months</b> of expenses covered
                (<span style="color:var(--txt)">${fmt(totalLiqFree)}</span> deployable liquid ÷ <span style="color:var(--txt)">${fmt(total)}</span>/mo)
              </div>` : ""}`;

            // In view mode, the amount renders as plain formatted text
            // (fmt() gives "₹1,00,000") rather than a number input — native
            // <input type="number"> can't display comma grouping even when
            // readonly, so it was showing raw digits ("100000") next to
            // properly formatted totals elsewhere on the card. The dot's
            // color reflects the item's category (Rent/EMI/Utility/
            // Insurance/Subscription/Other) rather than just cycling a
            // palette by position, so it carries real meaning at a glance.
            // The delete button is always rendered (never omitted) — the
            // row is a 4-column CSS grid (dot / name / amount / delete),
            // and omitting the 4th cell entirely in view mode would shift
            // the amount into its column; only its own data-role (which
            // is what makes it clickable) is conditional on edit mode.
            renderItemList(wrap.querySelector(".expenses-list-wrap"), {
              items,
              editMode,
              addLabel: "+ Add Fixed Expense",
              addBtnClass: "exp-add-btn",
              hadFocusInside,
              emptyEditText: `No fixed expenses yet — use "+ Add Fixed Expense" below.`,
              emptyViewText: `No fixed expenses added. Tap Edit to add rent, EMIs, subscriptions, etc.`,
              renderRow: (item, editMode) => {
                const cat = normalizeExpenseCategory(item.category);
                const startLabel = item.startDate ? fmtMonth(item.startDate.slice(0, 7)) : "";
                return `
                <li class="exp-row">
                  <span class="exp-dot" style="background:${cat.color}" title="${cat.label}"></span>
                  <div class="exp-name-col">
                    <input class="exp-name-inp" data-id="${item.id}" value="${item.name || ""}" placeholder="Expense name" ${editMode ? "" : "readonly"}/>
                    <div class="exp-meta-row">
                      ${editMode
                        ? `<select class="exp-cat-sel" data-id="${item.id}">${EXPENSE_CATEGORIES.map(c => `<option value="${c.key}"${c.key === cat.key ? " selected" : ""}>${c.label}</option>`).join("")}</select>
                           <input type="date" class="exp-date-inp" data-id="${item.id}" value="${item.startDate || ""}" title="Start date — this expense won't count toward months before this"/>`
                        : `<span class="exp-cat-tag" style="color:${cat.color}">${cat.label}</span>
                           ${startLabel ? `<span class="exp-date-tag" title="Doesn't count before ${startLabel}">from ${startLabel}</span>` : ""}`}
                    </div>
                  </div>
                  ${editMode
                    ? `<input type="number" class="exp-amt-inp" data-id="${item.id}" min="0" step="100" value="${item.amount || ""}" placeholder="0"/>`
                    : `<span class="exp-amt-txt">${fmt(item.amount || 0)}</span>`}
                  <button class="exp-del-btn" ${editMode ? `data-role="delete-item"` : ""} data-id="${item.id}" aria-label="Delete ${item.name || "expense"}" style="visibility:${editMode ? "visible" : "hidden"}">✕</button>
                </li>`;
              },
              onAdd: () => {
                if (!state.surplus.fixedExpenses) state.surplus.fixedExpenses = [];
                state.surplus.fixedExpenses.push({ id: "exp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), name: "", amount: 0 });
                saveState();
                renderExpenses();
                renderExpenseTrends();
              },
              onDelete: (id) => {
                state.surplus.fixedExpenses = items.filter(i => i.id !== id);
                saveState();
                renderExpenses();
                renderExpenseTrends();
                renderHealthScore();
                renderFireProgress();
              },
            });

            if (_animOnRender && !editMode)
              wrap.querySelectorAll(".alloc-seg-bar").forEach(bar => animateWidth(bar, 100, 800));

            wrap.querySelectorAll(".exp-name-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                if (!editMode) { renderExpenses(); return; }
                const item = items.find(i => i.id === e.target.dataset.id);
                if (item) { item.name = e.target.value; saveState(); }
              });
            });
            wrap.querySelectorAll(".exp-cat-sel").forEach(sel => {
              sel.addEventListener("change", e => {
                const item = items.find(i => i.id === e.target.dataset.id);
                if (!item) return;
                item.category = e.target.value;
                saveState();
                renderExpenses();
              });
            });
            wrap.querySelectorAll(".exp-date-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                const item = items.find(i => i.id === e.target.dataset.id);
                if (!item) return;
                item.startDate = e.target.value || "";
                saveState();
                renderExpenses();
                renderExpenseTrends();
                renderHealthScore();
                renderFireProgress();
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
                renderExpenseTrends();
                renderHealthScore();
                renderFireProgress();
              });
            });
          }

/* Expense Trends — split out of renderExpenses() into its own card: average/
   mo + projections over a chosen lookback period, with each category
   (Fixed / Extra / SIP) individually toggleable so the average only counts
   what the user actually wants counted (SIP defaults off), plus an Income
   vs Expenses chart over the same period. A self-contained analysis tool
   with its own controls, a different concern from Expenses' job of
   managing this month's actual numbers. */
function renderExpenseTrends() {
            const card = el("sumExpTrendsCard");
            const wrap = el("sumExpTrendsBody");
            if (!card || !wrap) return;
            card.style.display = "";

            const items = state.surplus?.fixedExpenses || [];
            const periodKeys = resolvePeriodKeys(expPeriod);
            const series = monthlyExpenseSeries(periodKeys, {
              fixedExpenses: items, liqFunds: LIQ_FUNDS, eqFunds: EQ_FUNDS,
              liquid: state.liquid, equity: state.equity, networth: state.networth,
              transactions: state.transactions,
            });
            const brk = averageExpenseBreakdown(series);
            let avgTotal = 0;
            if (expIncludeFixed) avgTotal += brk.avgFixed;
            if (expIncludeExtra) avgTotal += brk.avgExtra;
            if (expIncludeSip) avgTotal += brk.avgSip;

            // Income vs Expenses over the same selected period — Income is
            // carried forward month to month (see monthlyIncomeSeries()),
            // so this reads sensibly even for months between actual raises.
            const incomeSeries = monthlyIncomeSeries(periodKeys, state.networth);
            const incBrk = averageIncome(incomeSeries);
            const avgSavingsRate = incBrk.avgIncome > 0 ? ((incBrk.avgIncome - avgTotal) / incBrk.avgIncome) * 100 : null;

            const previewEl = el("sumExpTrendsPreview");
            if (previewEl) previewEl.textContent = brk.monthsWithData > 0 ? ((avgTotal < 0 ? "−" : "") + fmt(Math.abs(avgTotal)) + "/mo") : "";

            const periodChipsHtml = EXPENSE_PERIODS.map(p =>
              `<button class="txn-preset${expPeriod === p.key ? " active" : ""}" data-period="${p.key}">${p.label}</button>`
            ).join("");

            // fmt() clamps negatives to ₹0 (fine for amounts that are
            // never negative) — but avgExtra genuinely can go negative
            // (months where less left the bank than was planned), and
            // silently showing "₹0" there would hide a real underspend
            // instead of revealing it, which is the whole point of this row.
            const fmtAvg = (n) => (n < 0 ? "−" : "") + fmt(Math.abs(n));
            const catRow = (key, label, checked, avgVal) => `
              <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;padding:7px 10px;border-radius:8px;background:var(--panel-2);">
                <span style="display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--txt);">
                  <input type="checkbox" class="exp-cat-chk" data-cat="${key}" ${checked ? "checked" : ""} style="accent-color:var(--mint);width:14px;height:14px;cursor:pointer;margin:0;"/>
                  ${label}
                </span>
                <span style="font-family:'Roboto Mono',monospace;font-size:11px;color:var(--dim);">${fmtAvg(avgVal)}/mo</span>
              </label>`;

            // Grouped bar chart, Income vs Expense per month across the
            // selected period — paired by index since both series were
            // built from the same periodKeys.
            const chartMonths = periodKeys.map((key, i) => ({
              // Clamped to 0 for the chart's own bar heights — a month's
              // expense total can genuinely go negative (an under-spend
              // month, see averageExpenseBreakdown's avgExtra comment
              // above), which would otherwise produce an invalid negative
              // <rect> height.
              key,
              income: Math.max(0, incomeSeries[i]?.income ?? 0),
              expense: Math.max(0, series[i]?.total ?? 0),
            }));
            const incExpChartHtml = chartMonths.some(m => m.income > 0 || m.expense > 0)
              ? (() => {
                  const W = 600, H = 120, PAD_T = 8, PAD_B = 22;
                  const maxV = Math.max(...chartMonths.map(m => Math.max(m.income, m.expense)), 1);
                  const gap = W / chartMonths.length;
                  const bw = Math.max(3, Math.floor(gap * 0.3));
                  const bars = chartMonths.map((m, i) => {
                    const cx = (i + 0.5) * gap;
                    const incH = (m.income / maxV) * (H - PAD_T - PAD_B);
                    const expH = (m.expense / maxV) * (H - PAD_T - PAD_B);
                    const lbl = new Date(m.key + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
                    return `<rect x="${(cx - bw - 1).toFixed(1)}" y="${(H - PAD_B - incH).toFixed(1)}" width="${bw}" height="${incH.toFixed(1)}" rx="1.5" fill="var(--mint)" opacity="0.85"/>
                      <rect x="${(cx + 1).toFixed(1)}" y="${(H - PAD_B - expH).toFixed(1)}" width="${bw}" height="${expH.toFixed(1)}" rx="1.5" fill="var(--coral)" opacity="0.85"/>
                      <text x="${cx.toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="7" fill="var(--dim)" font-family="Roboto Mono,monospace">${lbl}</text>`;
                  }).join("");
                  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:104px;display:block;overflow:visible;">${bars}</svg>
                    <div style="display:flex;gap:14px;margin-top:6px;">
                      <span style="display:inline-flex;align-items:center;gap:5px;font-size:9px;color:var(--dim);"><span style="width:8px;height:8px;border-radius:2px;background:var(--mint);display:inline-block;"></span>Income</span>
                      <span style="display:inline-flex;align-items:center;gap:5px;font-size:9px;color:var(--dim);"><span style="width:8px;height:8px;border-radius:2px;background:var(--coral);display:inline-block;"></span>Expenses</span>
                    </div>`;
                })()
              : "";

            const incExpBlockHtml = incBrk.monthsWithData > 0 ? `
                <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);">
                  <div style="font-size:10px;color:var(--dim);margin-bottom:8px;">Income vs Expenses</div>
                  ${incExpChartHtml}
                  <div class="exp-stat-grid" style="margin-top:10px;">
                    <div class="exp-stat-card"><div class="lbl">Avg Income</div><div class="val">${fmtAvg(incBrk.avgIncome)}</div></div>
                    <div class="exp-stat-card"><div class="lbl">Avg Expenses</div><div class="val">${fmtAvg(avgTotal)}</div></div>
                    <div class="exp-stat-card"><div class="lbl">Savings Rate</div><div class="val" style="color:${avgSavingsRate === null ? "inherit" : avgSavingsRate >= 0 ? "var(--mint)" : "var(--coral)"}">${avgSavingsRate === null ? "—" : Math.round(avgSavingsRate) + "%"}</div></div>
                  </div>
                </div>` : "";

            const trendsBodyHtml = brk.monthsWithData > 0
              ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
                  ${catRow("fixed", "Fixed (Planned)", expIncludeFixed, brk.avgFixed)}
                  ${catRow("extra", "Unplanned (Extra)", expIncludeExtra, brk.avgExtra)}
                  ${catRow("sip", "SIP (Investment)", expIncludeSip, brk.avgSip)}
                </div>
                <div class="exp-hero">
                  <div class="exp-hero-top">
                    <span class="exp-hero-lbl">Average Expenses / Month</span>
                    <span class="exp-hero-val">${fmtAvg(avgTotal)}</span>
                  </div>
                  <div class="exp-hero-sub">Based on ${brk.monthsWithData} of ${brk.totalMonths} month${brk.totalMonths !== 1 ? "s" : ""} with Net Worth snapshot data${brk.monthsWithData < brk.totalMonths ? " — save more snapshots for a fuller picture" : ""}. Fixed &amp; SIP use today's amounts, applied to each month an expense was active in.</div>
                </div>
                <div style="margin-top:14px;">
                  <div style="font-size:10px;color:var(--dim);margin-bottom:8px;">Projected Expenses</div>
                  <div class="nw-proj-cards">
                    <div class="nw-proj-card"><div class="pk">3 months</div><div class="pv">${fmtAvg(avgTotal * 3)}</div></div>
                    <div class="nw-proj-card"><div class="pk">6 months</div><div class="pv">${fmtAvg(avgTotal * 6)}</div></div>
                    <div class="nw-proj-card"><div class="pk">12 months</div><div class="pv">${fmtAvg(avgTotal * 12)}</div></div>
                  </div>
                </div>
                ${incExpBlockHtml}`
              : `<div style="font-size:10.5px;color:var(--dim);padding:8px 0;">No Net Worth snapshots in this period yet — save monthly snapshots on the Net Worth tab to see trends and projections.</div>`;

            wrap.innerHTML = `
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">${periodChipsHtml}</div>
              ${trendsBodyHtml}`;

            wrap.querySelectorAll("[data-period]").forEach(btn => {
              btn.addEventListener("click", () => {
                expPeriod = btn.dataset.period;
                renderExpenseTrends();
              });
            });
            wrap.querySelectorAll(".exp-cat-chk").forEach(chk => {
              chk.addEventListener("change", e => {
                const cat = e.target.dataset.cat;
                if (cat === "fixed") expIncludeFixed = e.target.checked;
                if (cat === "extra") expIncludeExtra = e.target.checked;
                if (cat === "sip") expIncludeSip = e.target.checked;
                renderExpenseTrends();
              });
            });
          }

/* Financial Goals — a named list (state.surplus.goals), each measured
   independently against the SAME current net worth (there's no fund-
   earmarking infrastructure to actually split money between goals, so
   each goal just answers "at this rate, when would this much be
   reached"). A brand-new goal's amount field defaults blank rather than
   prefilled with the suggested 25×-expenses figure — that suggestion is
   shown as a footnote hint instead, since it's a reasonable default for
   "my whole net worth target" but not for an arbitrary named goal like a
   house downpayment. Reuses the Expenses card's total and the Net Worth
   tab's snapshot history for the growth-rate projection, so this needs no
   other state of its own. */
function renderFireProgress() {
            const card = el("sumFireCard");
            const wrap = el("sumFireBody");
            if (!card || !wrap) return;

            const monthlyExp = totalMonthlyExpenses({
              fixedExpenses: state.surplus?.fixedExpenses, liqFunds: LIQ_FUNDS, eqFunds: EQ_FUNDS,
              liquid: state.liquid, equity: state.equity, networth: state.networth,
              transactions: state.transactions,
            }).total;
            const suggestedTarget = monthlyExp * 12 * 25;
            const goals = state.surplus?.goals || [];

            if (!goals.length && !editMode) { card.style.display = "none"; return; }
            card.style.display = "";

            const cur = nwTotal(state.networth, LIQ_FUNDS, EQ_FUNDS, state.liquid, state.equity);
            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps).map(([k, v]) => normalizeSnap(k, v)).sort((a, b) => a.key.localeCompare(b.key));
            const r = sorted.length >= 2 ? avgMonthlyGrowthRate(sorted) : 0;

            const etaFor = (target) => {
              if (target <= 0) return `<span style="color:var(--dim)">Set a target amount below.</span>`;
              if (cur >= target) return `<span style="color:var(--mint);font-weight:600;">Reached 🎉</span>`;
              if (sorted.length < 2 || r <= 0) return `<span style="color:var(--dim)">Add more monthly Net Worth snapshots to project a timeline.</span>`;
              const monthsAway = monthsToReach(target, cur, r);
              const yrsAway = monthsAway / 12;
              const etaDate = new Date();
              etaDate.setMonth(etaDate.getMonth() + Math.round(monthsAway));
              const etaLabel = etaDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
              return `~<b style="color:var(--txt)">${yrsAway.toFixed(1)} years</b> away — projected <b style="color:var(--txt)">${etaLabel}</b>.`;
            };

            const previewEl = el("sumFirePreview");
            if (previewEl) previewEl.textContent = goals.length ? `${goals.length} goal${goals.length !== 1 ? "s" : ""}` : "";

            // wrap is the same persistent DOM node across every render —
            // capture focus against it before smashing its innerHTML below,
            // so renderItemList() can restore focus correctly afterward.
            const hadFocusInside = wrap.contains(document.activeElement);

            wrap.innerHTML = `
              <div style="font-size:10.5px;color:var(--dim);margin-bottom:10px;">Current Net Worth: <b style="color:var(--txt)">${fmt(cur)}</b></div>
              <div class="goals-list-wrap"></div>
              ${editMode ? `<div style="font-size:9px;color:var(--dim);opacity:0.8;margin-top:8px;">Suggested (25&times; annual expenses, the 4% withdrawal rule): ${fmt(suggestedTarget)}</div>` : ""}`;

            renderItemList(wrap.querySelector(".goals-list-wrap"), {
              items: goals,
              editMode,
              addLabel: "+ Add Goal",
              emptyEditText: `No goals yet — use "+ Add Goal" below.`,
              emptyViewText: `No goals added. Tap Edit to add one.`,
              hadFocusInside,
              renderRow: (g, editMode) => {
                const target = g.amount || 0;
                const progressPct = target > 0 ? Math.min(100, (cur / target) * 100) : 0;
                return `
                  <li style="padding:12px 0;border-bottom:1px solid var(--line);">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px;">
                      ${editMode
                        ? `<input class="goal-name-inp" data-id="${g.id}" value="${g.name || ""}" placeholder="Goal name"
                            style="flex:1;min-width:0;background:var(--input-bg,rgba(255,255,255,0.06));border:1px solid var(--line);border-radius:5px;color:var(--txt);font-size:12px;padding:5px 8px;"/>`
                        : `<span style="font-size:12.5px;color:var(--txt);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.name || "Goal"}</span>`}
                      <span style="font-family:'Roboto Mono',monospace;font-size:14px;font-weight:700;color:var(--mint);flex-shrink:0;">${target > 0 ? progressPct.toFixed(1) + "%" : "—"}</span>
                      ${editMode ? `<button type="button" data-role="delete-item" data-id="${g.id}" aria-label="Delete ${g.name || "goal"}" style="background:none;border:none;color:var(--coral);cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0;">✕</button>` : ""}
                    </div>
                    <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin-bottom:7px;">
                      <div class="fire-bar" data-w="${progressPct.toFixed(1)}" style="height:100%;width:0%;background:linear-gradient(90deg,var(--liq),var(--mint));border-radius:4px;"></div>
                    </div>
                    <div style="font-size:10.5px;color:var(--dim);line-height:1.5;">
                      ${target > 0 ? `${fmt(cur)} of ${fmt(target)} — ` : ""}${etaFor(target)}
                    </div>
                    ${editMode ? `
                    <div style="margin-top:8px;display:flex;align-items:center;gap:6px;">
                      <span style="font-size:11px;color:var(--dim)">₹</span>
                      <input type="number" class="goal-amt-inp" data-id="${g.id}" min="0" step="10000" value="${g.amount || ""}" placeholder="Target amount"
                        style="flex:1;background:var(--input-bg,rgba(255,255,255,0.06));border:1px solid var(--line);border-radius:5px;color:var(--txt);
                               font-family:'Roboto Mono',monospace;font-size:11px;padding:4px 7px;"/>
                    </div>` : ""}
                  </li>`;
              },
              onAdd: () => {
                if (!state.surplus.goals) state.surplus.goals = [];
                state.surplus.goals.push({ id: "goal_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), name: "", amount: 0 });
                saveState();
                renderFireProgress();
              },
              onDelete: (id) => {
                state.surplus.goals = goals.filter(g => g.id !== id);
                saveState();
                renderFireProgress();
              },
            });

            wrap.querySelectorAll(".fire-bar").forEach(bar => {
              const w = parseFloat(bar.dataset.w) || 0;
              if (_animOnRender) animateWidth(bar, w, 1200);
              else bar.style.width = w + "%";
            });

            wrap.querySelectorAll(".goal-name-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                const g = goals.find(x => x.id === e.target.dataset.id);
                if (g) { g.name = e.target.value; saveState(); }
              });
            });
            wrap.querySelectorAll(".goal-amt-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                const g = goals.find(x => x.id === e.target.dataset.id);
                if (!g) return;
                g.amount = Math.max(0, parseFloat(e.target.value) || 0);
                saveState();
                renderFireProgress();
              });
            });
          }

/* Loans / EMIs — a standalone tracker for loan balances and monthly EMI
   outflow. Deliberately NOT wired into Net Worth, Health Score, Tax
   Estimate, or FIRE progress: all of those currently assume asset-only net
   worth, and every one of them (plus every saved Net Worth snapshot) would
   need rework to subtract liabilities correctly — a much bigger, riskier
   change than a plain tracking card. "EMI" is also a listed Expenses
   category, but that's a separate manually-entered figure for this
   month's spend total — the two aren't linked, by design, for the same
   reason. */
function renderLoans() {
            const card = el("sumLoansCard");
            const wrap = el("sumLoansBody");
            if (!card || !wrap) return;

            const loans = state.loans || [];
            if (!loans.length && !editMode) { card.style.display = "none"; return; }
            card.style.display = "";

            const totalOutstanding = loans.reduce((s, l) => s + (l.outstanding || 0), 0);
            const totalEmi = loans.reduce((s, l) => s + (l.emi || 0), 0);

            const previewEl = el("sumLoansPreview");
            if (previewEl) previewEl.textContent = loans.length ? fmt(totalOutstanding) + " outstanding" : "";

            const fieldStyle = "width:100%;background:var(--input-bg,rgba(255,255,255,0.06));border:1px solid var(--line);border-radius:5px;color:var(--txt);font-family:'Roboto Mono',monospace;font-size:11px;text-align:right;padding:5px 6px;";

            // wrap is the same persistent DOM node across every render —
            // capture focus against it before smashing its innerHTML below,
            // so renderItemList() can restore focus correctly afterward.
            const hadFocusInside = wrap.contains(document.activeElement);

            wrap.innerHTML = `
              <div class="loans-list-wrap"></div>
              ${loans.length ? `
              <div class="exp-stat-grid" style="margin-top:14px;">
                <div class="exp-stat-card"><div class="lbl">Total Outstanding</div><div class="val">${fmt(totalOutstanding)}</div></div>
                <div class="exp-stat-card"><div class="lbl">Total Monthly EMI</div><div class="val">${fmt(totalEmi)}</div></div>
              </div>
              <div style="font-size:9px;color:var(--dim);opacity:0.8;margin-top:10px;">Tracked for reference only — not subtracted from Net Worth or any other total in this app.</div>
              ` : ""}`;

            renderItemList(wrap.querySelector(".loans-list-wrap"), {
              items: loans,
              editMode,
              addLabel: "+ Add Loan",
              hadFocusInside,
              emptyEditText: `No loans yet — use "+ Add Loan" below.`,
              emptyViewText: `No loans added.`,
              renderRow: (l, editMode) => `
                <li style="padding:10px 0;border-bottom:1px solid var(--line);">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
                    ${editMode
                      ? `<input class="loan-name-inp" data-id="${l.id}" value="${l.name || ""}" placeholder="Loan name" style="flex:1;min-width:0;background:var(--input-bg,rgba(255,255,255,0.06));border:1px solid var(--line);border-radius:5px;color:var(--txt);font-size:12px;padding:5px 8px;"/>`
                      : `<span style="font-size:12.5px;color:var(--txt);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.name || "Loan"}</span>`}
                    ${editMode ? `<button type="button" data-role="delete-item" data-id="${l.id}" aria-label="Delete ${l.name || "loan"}" style="background:none;border:none;color:var(--coral);cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0;">✕</button>` : ""}
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                    <div>
                      <div style="font-size:9px;color:var(--dim);margin-bottom:3px;">Outstanding</div>
                      ${editMode
                        ? `<div class="ibox"><span class="pfx">₹</span><input type="number" class="loan-outstanding-inp" data-id="${l.id}" min="0" step="1000" value="${l.outstanding || ""}" placeholder="0" style="${fieldStyle}"/></div>`
                        : `<div style="font-family:'Roboto Mono',monospace;font-size:12px;color:var(--txt);">${fmt(l.outstanding || 0)}</div>`}
                    </div>
                    <div>
                      <div style="font-size:9px;color:var(--dim);margin-bottom:3px;">Monthly EMI</div>
                      ${editMode
                        ? `<div class="ibox"><span class="pfx">₹</span><input type="number" class="loan-emi-inp" data-id="${l.id}" min="0" step="500" value="${l.emi || ""}" placeholder="0" style="${fieldStyle}"/></div>`
                        : `<div style="font-family:'Roboto Mono',monospace;font-size:12px;color:var(--txt);">${fmt(l.emi || 0)}</div>`}
                    </div>
                    <div>
                      <div style="font-size:9px;color:var(--dim);margin-bottom:3px;">Rate</div>
                      ${editMode
                        ? `<input type="number" class="loan-rate-inp" data-id="${l.id}" min="0" max="50" step="0.1" value="${l.rate || ""}" placeholder="0" style="${fieldStyle}"/>`
                        : `<div style="font-family:'Roboto Mono',monospace;font-size:12px;color:var(--txt);">${l.rate ? l.rate + "%" : "—"}</div>`}
                    </div>
                  </div>
                </li>`,
              onAdd: () => {
                if (!state.loans) state.loans = [];
                state.loans.push({ id: "loan_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), name: "", outstanding: 0, emi: 0, rate: 0 });
                saveState();
                renderLoans();
              },
              onDelete: (id) => {
                state.loans = loans.filter(l => l.id !== id);
                saveState();
                renderLoans();
              },
            });

            wrap.querySelectorAll(".loan-name-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                const l = loans.find(x => x.id === e.target.dataset.id);
                if (l) { l.name = e.target.value; saveState(); }
              });
            });
            wrap.querySelectorAll(".loan-outstanding-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                const l = loans.find(x => x.id === e.target.dataset.id);
                if (!l) return;
                l.outstanding = Math.max(0, parseFloat(e.target.value) || 0);
                saveState();
                renderLoans();
              });
            });
            wrap.querySelectorAll(".loan-emi-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                const l = loans.find(x => x.id === e.target.dataset.id);
                if (!l) return;
                l.emi = Math.max(0, parseFloat(e.target.value) || 0);
                saveState();
                renderLoans();
              });
            });
            wrap.querySelectorAll(".loan-rate-inp").forEach(inp => {
              inp.addEventListener("change", e => {
                const l = loans.find(x => x.id === e.target.dataset.id);
                if (!l) return;
                l.rate = Math.max(0, parseFloat(e.target.value) || 0);
                saveState();
              });
            });
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

/* Per-fund XIRR breakdown inside the expanded Portfolio XIRR card — same
   fundXirr() call the Fund Performance table's XIRR column uses, just
   listed plainly here so expanding the headline number is enough to see
   which fund is actually driving it, without jumping to that table.
   Funds with no computable XIRR (no transactions logged yet) still show
   up with a dash rather than being silently dropped, matching how the
   Fund Performance table treats them. */
function renderXirrFundList() {
            const wrap = el("sumXirrFundList");
            if (!wrap) return;
            const rows = [...LIQ_FUNDS.map(f => ({ f, isLiq: true })), ...EQ_FUNDS.map(f => ({ f, isLiq: false }))]
              .map(({ f, isLiq }) => {
                const s = isLiq ? state.liquid[f.id] : state.equity[f.id];
                const invested = s?.paid || 0;
                const current = isLiq ? (s?.currentValue || s?.value || 0) : (s?.currentValue || s?.shown || 0);
                return { name: fundName(f.id), xirr: fundXirr(f.id, isLiq, s, state.transactions), invested, current };
              })
              .filter(r => r.invested > 0 || r.current > 0);

            if (!rows.length) { wrap.innerHTML = ""; return; }

            wrap.innerHTML = `
              <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:9px;">XIRR by Fund</div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${rows.map(r => {
                  const hasXirr = r.xirr !== null;
                  const isUp = hasXirr && r.xirr >= 0;
                  const valTxt = hasXirr ? (isUp ? "+" : "") + (r.xirr * 100).toFixed(2) + "%" : "—";
                  const color = !hasXirr ? "var(--dim)" : isUp ? "var(--mint)" : "var(--coral)";
                  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                    <span style="font-size:12px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.name}</span>
                    <span style="font-family:'Roboto Mono',monospace;font-size:12px;font-weight:700;color:${color};white-space:nowrap;">${valTxt}</span>
                  </div>`;
                }).join("")}
              </div>
            `;
          }

/* Small trend line inside the Portfolio XIRR card — recomputes XIRR as of
   each historical net worth snapshot (see rollingPortfolioXirr) rather than
   just showing today's single number, so a slipping/improving return rate
   is visible at a glance. Needs 3+ snapshots with a computable XIRR to be
   worth showing as a "trend" at all. */
function renderXirrTrend() {
            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps).map(([k, v]) => normalizeSnap(k, v)).sort((a, b) => a.key.localeCompare(b.key));
            const points = rollingPortfolioXirr(sorted, state.transactions).filter(p => p.xirr !== null);

            renderTrendChart(el("sumXirrTrend"), null, points.map(p => p.xirr * 100), {
              wrapEl: el("sumXirrTrendWrap"),
              showZeroLine: true,
              colorFor: last => last >= 0 ? "var(--mint)" : "var(--coral)",
            });
          }

// Portfolio XIRR — collapsed state only shows the headline number;
// expanding reveals the per-fund breakdown and the trend chart, so you
// don't need to jump to the Fund Performance table just to see which
// fund is driving it. Split out from a single renderXirrAndHeatmap() that
// used to also render Investment Streak and Returns Heatmap below — three
// unrelated cards sharing nothing, now each gets its own function like
// every other card in this file already does.
function renderPortfolioXirr() {
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
            renderXirrFundList();
            renderXirrTrend();
          }

// Investment streak — collapsed state just shows the title + 🔥 count (via
// #sumStreakPreview); expanded adds a month-by-month invested breakdown
// covering the streak's own range.
function renderInvestmentStreak() {
            const streakCard = el("sumStreakCard");
            if (!streakCard) return;
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
              const streakPreview = el("sumStreakPreview");
              if (streakPreview) streakPreview.textContent = "🔥 " + streak;
              const rangeEl = el("sumStreakRange");
              const fmtMo = d => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
              if (rangeEl) {
                const startD = new Date(now.getFullYear(), now.getMonth() - (streak - 1), 1);
                rangeEl.textContent = `${fmtMo(startD)} – ${fmtMo(now)}`;
              }
              const monthlyEl = el("sumStreakMonthly");
              if (monthlyEl) {
                const rows = [];
                for (let i = streak - 1; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
                  const amt = (state.transactions || [])
                    .filter(t => t.type !== "redemption" && t.date && t.date.slice(0, 7) === key)
                    .reduce((s, t) => s + (Number(t.afterExpense ?? t.invested) || 0), 0);
                  rows.push({ label: fmtMo(d), amt });
                }
                monthlyEl.innerHTML = `
                  <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Monthly Breakdown</div>
                  ${rows.map(r => `
                    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line);font-size:11px;">
                      <span style="color:var(--dim)">${r.label}</span>
                      <span style="font-family:'Roboto Mono',monospace;color:var(--txt);font-weight:600;">${fmt(r.amt)}</span>
                    </div>`).join("")}`;
              }
              streakCard.style.display = "";
            } else {
              streakCard.style.display = "none";
            }
          }

// Returns heatmap using networth snapshots.
function renderReturnsHeatmap() {
            const hmCard = el("sumHeatmapCard");
            const hmEl = el("sumHeatmap");
            if (!hmCard || !hmEl) return;
            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps).map(([k, v]) => normalizeSnap(k, v)).sort((a, b) => a.key.localeCompare(b.key));
            if (sorted.length < 2) { hmCard.style.display = "none"; return; }
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

