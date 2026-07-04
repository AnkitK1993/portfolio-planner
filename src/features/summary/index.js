import { EQ_CATEGORIES } from "../../core/constants.js";
import { EQ_FUNDS, LIQ_FUNDS, fundName, normalizeSnap, state } from "../../core/state.js";
import { UI } from "../../core/ui.js";
import { _animOnRender, _animRaf, animateNumber, animateWidth } from "../../core/animate.js";
import { cachedPortfolioXirr, fundXirr } from "../../domain/xirr.js";
import { el } from "../../core/dom.js";
import { fmt, fmtCompact, pct } from "../../core/format.js";
import { renderAllocBars } from "../portfolio/allocation.js";
import { renderIdealAlloc } from "./rebalance.js";

export function renderSummaryExtras(eqCur, liqCur, totCur, eqTgt, liqTgt, totTgt, nowEqPct, tgtEqPct) {
            /* — Drift alert — */
            const driftEl = el("sumDriftAlert");
            if (driftEl) {
              driftEl.style.display = "none";
            }

            /* — Health Score — */
            renderHealthScore();

            /* — Ideal Allocation card — */
            renderIdealAlloc();

            /* — Fund performance table — */
            renderFundTable();
            /* — XIRR + heatmap — */
            renderXirrAndHeatmap();
            /* — Allocation bars — */
            renderAllocBars();
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

export function renderFundTable() {
            const wrap = el("sumFundTable");
            if (!wrap) return;

            const rows = [...LIQ_FUNDS.map(f => ({ f, isLiq: true })), ...EQ_FUNDS.map(f => ({ f, isLiq: false }))]
              .map(({ f, isLiq }) => {
                const s = isLiq ? state.liquid[f.id] : state.equity[f.id];
                const invested = s.paid || 0;
                const current = s.currentValue || (isLiq ? (s.value || 0) : (s.shown || 0));
                const returns = current - invested;
                return {
                  name: fundName(f.id),
                  isLiq,
                  invested,
                  current,
                  returns,
                  returnsPct: pct(returns, invested),
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
              const retClass = r.returns >= 0 ? "mint" : "coral";
              const xirrTxt = r.xirr == null ? "—" : (r.xirr * 100 >= 0 ? "+" : "") + (r.xirr * 100).toFixed(2) + "%";
              const xirrClass = r.xirr == null ? "" : r.xirr >= 0 ? "mint" : "coral";
              return `<div class="fperf-row">
                <span class="fperf-name">${r.name}<span class="fp-tag ${r.isLiq ? "liq" : "eq"}">${r.isLiq ? "LIQ" : "EQ"}</span></span>
                <span class="fperf-num">${fmtCompact(r.invested)}</span>
                <span class="fperf-num" style="color:var(--${retClass})">${signedCompact(r.returns)}</span>
                <span class="fperf-num" style="color:var(--${retClass})">${(r.returnsPct >= 0 ? "+" : "")}${r.returnsPct.toFixed(2)}%</span>
                <span class="fperf-num"${xirrClass ? ` style="color:var(--${xirrClass})"` : ""}>${xirrTxt}</span>
              </div>`;
            }).join("");

            wrap.innerHTML = `<div class="fperf-table">
              <div class="fperf-row fperf-head">${headHtml}</div>
              ${rowsHtml}
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
            const monthlyExp = state.surplus?.expenses || 0;
            let bScore = 15, bNote = "Enter expenses to measure";
            if (monthlyExp > 0) {
              const bufMonths = totalLiqFree / monthlyExp;
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
            const allTxns2 = (state.transactions || []).filter(t => t.date && Number(t.invested) > 0);
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
            const gc    = total >= 80 ? "var(--mint)" : total >= 60 ? "#86efac" : total >= 40 ? "var(--amber)" : "var(--coral)";

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
              { label: "Consistency",  score: cScore, note: cNote, color: "var(--liq)" },
              { label: "Allocation",   score: aScore, note: aNote, color: "var(--mint)" },
              { label: "Liq. Buffer",  score: bScore, note: bNote, color: "var(--amber)" },
              { label: "Returns",      score: rScore, note: rNote, color: "#c084fc" },
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
                    <div>
                      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                        <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:var(--dim)">${d.label}</span>
                        <span style="font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;color:${d.color}">${d.score}/25</span>
                      </div>
                      <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:3px;">
                        <div class="phs-dim-bar" data-w="${(d.score / 25 * 100).toFixed(0)}" style="height:100%;width:0%;background:${d.color};border-radius:3px;"></div>
                      </div>
                      <div style="font-size:9.5px;color:var(--dim)">${d.note}</div>
                    </div>`).join("")}
                </div>
              </div>`;

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

export function renderXirrAndHeatmap() {
            // Portfolio XIRR
            const xirrCard = el("sumXirrCard");
            const xirrEl = el("sumXirr");
            const fundXirrsEl = el("sumFundXirrs");
            if (xirrCard && xirrEl) {
              const allTxns = (state.transactions || []).filter(t => t.date && Number(t.invested) > 0);
              // Must prefer currentValue over the value/shown baseline, same
              // as fundXirr() and every other "current value" read in this
              // app (render.js, transactions/index.js) — otherwise this card
              // silently ignores whatever the user last entered via "Add
              // Current Value" and computes XIRR against the stale baseline.
              const totalVal = LIQ_FUNDS.reduce((s, f) => s + (state.liquid[f.id]?.currentValue || state.liquid[f.id]?.value || 0), 0) +
                               EQ_FUNDS.reduce((s, f) => s + (state.equity[f.id]?.currentValue || state.equity[f.id]?.shown || 0), 0);
              let portfolioXirr = null;
              if (allTxns.length && totalVal > 0) {
                portfolioXirr = cachedPortfolioXirr(allTxns, totalVal);
              }
              if (portfolioXirr !== null) {
                xirrCard.style.display = "";
                const pct = (portfolioXirr * 100).toFixed(2);
                const isUp = portfolioXirr >= 0;
                xirrEl.textContent = (isUp ? "+" : "") + pct + "%";
                xirrEl.style.color = isUp ? "var(--mint)" : "var(--coral)";

                // Per-fund XIRR chips
                if (fundXirrsEl) {
                  const chips = [...LIQ_FUNDS.map(f => ({ f, isLiq: true })), ...EQ_FUNDS.map(f => ({ f, isLiq: false }))]
                    .map(({ f, isLiq }) => {
                      const x = fundXirr(f.id, isLiq);
                      if (x === null) return "";
                      const p = (x * 100).toFixed(1);
                      const up = x >= 0;
                      return `<div style="background:var(--panel-2);border-radius:8px;padding:5px 10px;font-size:10px;">
                        <div style="color:var(--dim);margin-bottom:2px">${fundName(f.id)}</div>
                        <div style="font-family:'Roboto Mono',monospace;font-weight:700;color:${up ? "var(--mint)" : "var(--coral)"}">${up ? "+" : ""}${p}%</div>
                      </div>`;
                    }).join("");
                  fundXirrsEl.innerHTML = chips || `<span style="font-size:11px;color:var(--dim)">Add transactions to see per-fund XIRR.</span>`;
                }
              } else {
                xirrCard.style.display = "none";
              }
            }

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
                hmEl.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;">${rows}</div>`;
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
