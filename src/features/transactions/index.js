import { EQ_FUNDS, LIQ_FUNDS, fundName, saveState, state } from "../../core/state.js";
import { UI, closeNavDropdowns, collapseTxpCard, expandTxpCard, navigateTo } from "../../core/ui.js";
import { checkProfitMilestones, fundRowHTML } from "../portfolio/funds.js";
import { el } from "../../core/dom.js";
import { fmt, fmtNum, pct } from "../../core/format.js";
import { render, scheduleRender } from "../portfolio/render.js";
import { setFmtInner } from "../../core/animate.js";

export function setTxnType(type) {
            el("txnType").value = type;
            el("txnTypeToggle").querySelectorAll(".txn-type-btn").forEach(b => {
              b.classList.toggle("active", b.dataset.type === type);
            });
          }

export function applyTxnTotals() {
            if (!state.transactions || !state.transactions.length) return;
            const net = {}, sipTot = {}, lumpTot = {}, redeemTot = {};
            state.transactions.forEach(t => {
              const amt = Number(t.invested) || 0;
              if (t.type === "redemption") {
                redeemTot[t.fundId] = (redeemTot[t.fundId] || 0) + amt;
                net[t.fundId] = (net[t.fundId] || 0) - amt;
              } else if (t.type === "sip") {
                sipTot[t.fundId]  = (sipTot[t.fundId]  || 0) + amt;
                net[t.fundId]     = (net[t.fundId]     || 0) + amt;
              } else {
                lumpTot[t.fundId] = (lumpTot[t.fundId] || 0) + amt;
                net[t.fundId]     = (net[t.fundId]     || 0) + amt;
              }
            });
            LIQ_FUNDS.forEach(f => {
              if (net[f.id] !== undefined) {
                const paid = Math.max(0, net[f.id]);
                state.liquid[f.id].paid      = paid;
                state.liquid[f.id].sipPaid   = sipTot[f.id]    || 0;
                state.liquid[f.id].lumpPaid  = lumpTot[f.id]   || 0;
                state.liquid[f.id].redeemPaid= redeemTot[f.id] || 0;
                const inp = document.getElementById("lpaid-" + f.id);
                if (inp) inp.value = fmtNum(paid);
              }
            });
            EQ_FUNDS.forEach(f => {
              if (net[f.id] !== undefined) {
                const paid = Math.max(0, net[f.id]);
                state.equity[f.id].paid      = paid;
                state.equity[f.id].sipPaid   = sipTot[f.id]    || 0;
                state.equity[f.id].lumpPaid  = lumpTot[f.id]   || 0;
                state.equity[f.id].redeemPaid= redeemTot[f.id] || 0;
                const inp = document.getElementById("epaid-" + f.id);
                if (inp) inp.value = fmtNum(paid);
              }
            });
          }

export function openTxnModal(txnId) {
            const editId = txnId || null;
            el("txnEditId").value = editId || "";
            el("txnModalTitle").textContent = editId ? "Edit Transaction" : "Add Transaction";
            const today = new Date().toISOString().split("T")[0];

            if (editId) {
              const txn = (state.transactions || []).find(t => t.id === editId);
              el("txnDate").value = txn?.date || today;
              setTxnType(txn?.type || "sip");
              const isLiq = LIQ_FUNDS.some(f => f.id === txn?.fundId);
              const s = isLiq ? state.liquid[txn.fundId] : state.equity[txn.fundId];
              const defName = isLiq
                ? (LIQ_FUNDS.find(f => f.id === txn.fundId)?.defaultName || "Fund")
                : (EQ_FUNDS.find(f => f.id === txn.fundId)?.defaultName || "Fund");
              const name = s?.name || defName;
              el("txnFundInputList").innerHTML = fundRowHTML(txn.fundId, name, txn?.invested);
            } else {
              el("txnDate").value = today;
              setTxnType("sip");
              const allFunds = [
                ...LIQ_FUNDS.map(f => ({ id: f.id, name: state.liquid[f.id].name || f.defaultName })),
                ...EQ_FUNDS.map(f => ({ id: f.id, name: state.equity[f.id].name || f.defaultName })),
              ];
              el("txnFundInputList").innerHTML = allFunds.map(f => fundRowHTML(f.id, f.name, "")).join("");
            }
            navigateTo("transactions");
            expandTxpCard("txp-addtxn");
          }

export function closeTxnModal() {
            collapseTxpCard("txp-addtxn");
          }

export function saveTxn() {
            const date = el("txnDate").value;
            const editId = el("txnEditId").value;
            if (!date) { UI.toast("error", "Date is required", 2500); return; }
            if (!state.transactions) state.transactions = [];

            const txnType = el("txnType")?.value || "sip";
            if (editId) {
              const txn = state.transactions.find(t => t.id === editId);
              if (!txn) return;
              const invested = Number(el("txi-" + txn.fundId)?.value) || 0;
              if (!invested) { UI.toast("error", "Amount is required", 2500); return; }
              txn.date = date;
              txn.invested = invested;
              txn.type = txnType;
            } else {
              const allFunds = [...LIQ_FUNDS, ...EQ_FUNDS];
              let added = 0;
              const dups = [];
              if (txnType !== "redemption") {
                allFunds.forEach(f => {
                  const v = Number(el("txi-" + f.id)?.value) || 0;
                  if (v > 0) {
                    const existing = (state.transactions || []).find(t => t.fundId === f.id && t.date === date && t.type !== "redemption");
                    if (existing) dups.push(fundName(f.id));
                  }
                });
              }
              const doAdd = () => {
                allFunds.forEach(f => {
                  const v = Number(el("txi-" + f.id)?.value) || 0;
                  if (v > 0) {
                    state.transactions.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fundId: f.id, date, invested: v, notes: "" });
                    added++;
                  }
                });
                applyTxnTotals(); saveState(); render(); renderTxns(); closeTxnModal();
                UI.toast("success", txnType === "redemption" ? "Redemption recorded" : "Transaction added", 2000);
              };
              if (dups.length) {
                UI.confirm(`A transaction already exists on ${date} for: ${dups.join(", ")}. Add anyway?`, "Duplicate detected", "Add anyway", doAdd, false);
                return;
              }
              allFunds.forEach(f => {
                const v = Number(el("txi-" + f.id)?.value) || 0;
                if (v > 0) {
                  state.transactions.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fundId: f.id, date, invested: v, notes: "", type: txnType });
                  added++;
                }
              });
              if (!added) { UI.toast("warn", "Enter at least one amount", 2500); return; }
            }
            applyTxnTotals();
            saveState();
            render();
            renderTxns();
            closeTxnModal();
            UI.toast("success", editId ? "Transaction updated" : txnType === "redemption" ? "Redemption recorded" : "Transaction added", 2000);
          }

export function deleteTxn(id) {
            UI.confirm("This cannot be undone.", "Delete transaction?", "Delete", () => {
              state.transactions = (state.transactions || []).filter(t => t.id !== id);
              applyTxnTotals(); saveState(); render(); renderTxns();
            });
          }

export function renderHoldings() {
            let invested = 0, afterExp = 0, curVal = 0, liqCur = 0, eqCur2 = 0;
            LIQ_FUNDS.forEach(f => {
              const s = state.liquid[f.id];
              invested += s.paid || 0;
              const ae = s.value || 0;
              const cv = (s.currentValue > 0 ? s.currentValue : ae);
              afterExp += ae; curVal += cv; liqCur += cv;
            });
            EQ_FUNDS.forEach(f => {
              const s = state.equity[f.id];
              invested += s.paid || 0;
              const ae = s.shown || 0;
              const cv = (s.currentValue > 0 ? s.currentValue : ae);
              afterExp += ae; curVal += cv; eqCur2 += cv;
            });
            const returns = curVal - afterExp;
            const retPct  = afterExp > 0 ? (returns / afterExp * 100) : 0;
            const hasData = afterExp > 0;
            const isUp    = returns >= 0;
            const sign    = isUp ? "+" : "−";
            const arrow   = isUp ? "↑" : "↓";

            if (hasData) setFmtInner("holdingsTotal", curVal); else el("holdingsTotal").innerHTML = "—";

            const rtnEl = el("holdingsRtn");
            if (rtnEl) {
              if (hasData) {
                rtnEl.textContent = `${arrow} ${sign}${Math.abs(retPct).toFixed(2)}%`;
                rtnEl.className = `holdings-rtn ${isUp ? "up" : "dn"}`;
              } else { rtnEl.textContent = ""; rtnEl.className = "holdings-rtn"; }
            }

            el("hInvested").textContent  = hasData ? fmt(invested)  : "—";
            el("hAfterExp").textContent  = hasData ? fmt(afterExp)  : "—";
            el("hCurVal").textContent    = hasData ? fmt(curVal)    : "—";
            el("hLiquid").textContent    = liqCur  > 0 ? fmt(liqCur)  : "—";
            el("hEquity").textContent    = eqCur2  > 0 ? fmt(eqCur2)  : "—";

            const hRtnEl = el("hReturns");
            if (hRtnEl) {
              if (hasData) {
                hRtnEl.textContent = `${arrow} ${fmt(Math.abs(returns))} (${sign}${Math.abs(retPct).toFixed(2)}%)`;
                hRtnEl.className = `holdings-val ${isUp ? "up" : "dn"}`;
              } else { hRtnEl.textContent = "—"; hRtnEl.className = "holdings-val"; }
            }
            if (hasData) checkProfitMilestones(returns);
          }

export function txnDateRange() {
            if (txnFilter.dateFrom || txnFilter.dateTo) {
              return { from: txnFilter.dateFrom || "0000-01-01", to: txnFilter.dateTo || "9999-12-31" };
            }
            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];
            const p = txnFilter.preset;
            if (p === "month") {
              return { from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0], to: todayStr };
            }
            if (p === "lastmonth") {
              return {
                from: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split("T")[0],
                to: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0]
              };
            }
            if (p === "3m") {
              return { from: new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().split("T")[0], to: todayStr };
            }
            if (p === "6m") {
              return { from: new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split("T")[0], to: todayStr };
            }
            if (p === "year") {
              return { from: new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0], to: todayStr };
            }
            return { from: "0000-01-01", to: "9999-12-31" };
          }

export function renderTxns() {
            const container = el("txnList");
            if (!container) return;

            // Populate fund dropdown once
            const fundSel = el("txnFundFilter");
            if (fundSel && fundSel.options.length <= 1) {
              [...LIQ_FUNDS, ...EQ_FUNDS].forEach(f => {
                const opt = document.createElement("option");
                opt.value = f.id;
                opt.textContent = fundName(f.id);
                fundSel.appendChild(opt);
              });
              fundSel.value = txnFilter.fundId || "";
            }

            // Apply filters (single pass — chronoAll below reuses this result
            // instead of re-filtering the full transaction list a second time)
            const { from, to } = txnDateRange();
            let txns = (state.transactions || []).filter(t => {
              const d = t.date || "";
              if (d < from || d > to) return false;
              if (txnFilter.fundId && t.fundId !== txnFilter.fundId) return false;
              return true;
            });

            // Build running total map (always chronological regardless of sort)
            const chronoAll = [...txns].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

            // Apply sort (chronoAll is captured above, before this reorders txns)
            const srt = txnFilter.sort || "newest";
            if (srt === "newest")  txns.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
            else if (srt === "oldest") txns.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
            else if (srt === "highest") txns.sort((a, b) => (Number(b.invested) || 0) - (Number(a.invested) || 0));
            else if (srt === "lowest")  txns.sort((a, b) => (Number(a.invested) || 0) - (Number(b.invested) || 0));
            const runMap = {};
            let runSum = 0;
            chronoAll.forEach(t => { runSum += Number(t.invested) || 0; runMap[t.id] = runSum; });

            // Summary bar
            const summaryEl = el("txnSummary");
            if (summaryEl) {
              if (txns.length) {
                const total = txns.reduce((s, t) => s + (Number(t.invested) || 0), 0);
                const byFund = {};
                txns.forEach(t => { byFund[t.fundId] = (byFund[t.fundId] || 0) + (Number(t.invested) || 0); });
                const chips = Object.entries(byFund).length > 1
                  ? Object.entries(byFund).sort((a, b) => b[1] - a[1])
                      .map(([fid, amt]) => `<div class="txn-fund-chip">
                        <div class="txn-fund-chip-name">${fundName(fid)}</div>
                        <div class="txn-fund-chip-amt">${fmt(amt)}</div>
                      </div>`).join("")
                  : "";
                summaryEl.innerHTML = `<div class="txn-summary-bar">
                  <div class="txn-summary-top">
                    <span class="txn-summary-total">${fmt(total)}</span>
                    <span class="txn-summary-meta">${txns.length} transaction${txns.length !== 1 ? "s" : ""}</span>
                  </div>
                  ${chips ? `<div class="txn-fund-totals">${chips}</div>` : ""}
                </div>`;
              } else { summaryEl.innerHTML = ""; }
            }

            if (!txns.length) {
              container.innerHTML = `<div class="txn-empty">No transactions found for the selected filter.</div>`;
              return;
            }

            // Group by month → day (respects current sort order for display)
            const months = {};
            const monthOrder = [];
            txns.forEach(t => {
              const mKey = t.date ? t.date.slice(0, 7) : "unknown";
              const dKey = t.date || "unknown";
              if (!months[mKey]) { months[mKey] = {}; monthOrder.push(mKey); }
              if (!months[mKey][dKey]) months[mKey][dKey] = [];
              months[mKey][dKey].push(t);
            });

            let html = "";
            [...new Set(monthOrder)].forEach(mKey => {
              const days = months[mKey];
              const mLabel = mKey !== "unknown"
                ? new Date(mKey + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })
                : "Unknown Date";
              const mTotal = Object.values(days).flat().reduce((s, t) => s + (Number(t.invested) || 0), 0);
              html += `<div class="txn-month-head" style="display:flex;justify-content:space-between;align-items:center;">
                <span>${mLabel}</span>
                <span style="font-family:'Roboto Mono',monospace;font-size:10px;color:var(--mint);">${fmt(mTotal)}</span>
              </div>`;

              Object.entries(days).forEach(([dKey, list]) => {
                const dayTotal = list.reduce((s, t) => s + (Number(t.invested) || 0), 0);
                const dayNum = dKey !== "unknown" ? dKey.slice(8, 10) : "—";
                const dayMo = dKey !== "unknown"
                  ? new Date(dKey + "T00:00:00").toLocaleDateString("en-IN", { month: "short" })
                  : "";
                const countLabel = list.length > 1 ? `${list.length} transactions` : "";

                html += `<div class="txn-day-head">
                  <span class="txn-day-label">
                    <span class="txn-day-num">${dayNum}</span>${dayMo}
                    ${countLabel ? `<span class="txn-day-count">${countLabel}</span>` : ""}
                  </span>
                  <span class="txn-day-total">${fmt(dayTotal)}</span>
                </div>`;

                list.forEach(t => {
                  const runningTotal = runMap[t.id] || 0;
                  const isRedeem = t.type === "redemption";
                  const typeBadge = t.type === "sip"
                    ? `<span class="txn-badge txn-badge-sip">SIP</span>`
                    : t.type === "redemption"
                    ? `<span class="txn-badge txn-badge-redeem">Redeemed</span>`
                    : t.type === "lump"
                    ? `<span class="txn-badge txn-badge-lump">Lump</span>`
                    : "";
                  html += `<div class="txn-row txn-row-child${isRedeem ? " txn-row-redeemed" : ""}">
                    <div class="txn-info">
                      <div class="txn-fund-name">${fundName(t.fundId)}${typeBadge}</div>
                      ${t.notes ? `<div class="txn-sub">${t.notes}</div>` : ""}
                      <div class="txn-running">Running total: ${fmt(runningTotal)}</div>
                    </div>
                    <div class="txn-right">
                      <div class="txn-amt">${isRedeem ? "−" : ""}${fmt(t.invested)}</div>
                      <div class="txn-acts">
                        <button class="txn-act-btn edit" data-id="${t.id}">Edit</button>
                        <button class="txn-act-btn del" data-id="${t.id}">Del</button>
                      </div>
                    </div>
                  </div>`;
                });
              });
            });

            container.innerHTML = html;
            container.querySelectorAll(".txn-act-btn.edit").forEach(btn => {
              btn.addEventListener("click", e => { e.stopPropagation(); openTxnModal(btn.dataset.id); });
            });
            container.querySelectorAll(".txn-act-btn.del").forEach(btn => {
              btn.addEventListener("click", e => { e.stopPropagation(); deleteTxn(btn.dataset.id); });
            });

            renderTxnCharts(txns);
          }

export function renderTxnCharts(txns) {
            const chartsEl = el("txnCharts");
            if (!chartsEl) return;
            if (!txns || txns.length < 2) { chartsEl.style.display = "none"; return; }
            chartsEl.style.display = "";

            // ── Monthly bar chart ──
            const monthly = {};
            txns.forEach(t => {
              const mo = (t.date || "").slice(0, 7);
              if (!mo) return;
              monthly[mo] = (monthly[mo] || 0) + (Number(t.invested) || 0);
            });
            const months = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]));
            const barSvg = el("txnBarChart");
            if (barSvg && months.length) {
              const W = 600, H = 120, PAD_T = 8, PAD_B = 26;
              const maxV = Math.max(...months.map(([, v]) => v)) || 1;
              const bw = Math.max(6, Math.floor((W / months.length) * 0.65));
              const gap = W / months.length;
              const COLORS = ["var(--liq)", "var(--mint)", "var(--amber)", "var(--coral)", "#a78bfa", "#60a5fa"];

              const bars = months.map(([mo, v], i) => {
                const bh = ((v / maxV) * (H - PAD_T - PAD_B));
                const x = (i + 0.5) * gap - bw / 2;
                const y = H - PAD_B - bh;
                const lbl = new Date(mo + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
                const color = COLORS[i % COLORS.length];
                return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="2" fill="${color}" opacity="0.85"/>
                  <text x="${(x + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="7" fill="var(--dim)" font-family="Roboto Mono,monospace">${lbl}</text>`;
              }).join("");

              barSvg.innerHTML = bars;
            }

            // ── Fund donut chart ──
            const byFund = {};
            txns.forEach(t => {
              byFund[t.fundId] = (byFund[t.fundId] || 0) + (Number(t.invested) || 0);
            });
            const entries = Object.entries(byFund).sort((a, b) => b[1] - a[1]);
            const total = entries.reduce((s, [, v]) => s + v, 0);
            const donutSvg = el("txnFundDonut");
            const legendEl = el("txnFundLegend");
            const DONUT_COLORS = ["var(--mint)", "var(--liq)", "var(--amber)", "var(--coral)", "#a78bfa", "#60a5fa", "#f472b6", "#34d399"];

            if (donutSvg && entries.length) {
              const cx = 50, cy = 50, r = 36, stroke = 14;
              const circ = 2 * Math.PI * r;
              let cumPct = 0;
              const arcs = entries.map(([fid, v], i) => {
                const pct = v / total;
                const dash = pct * circ;
                const gap = circ - dash;
                const offset = circ * (1 - cumPct) - circ * 0.25;
                cumPct += pct;
                return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${DONUT_COLORS[i % DONUT_COLORS.length]}" stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" opacity="0.9"/>`;
              }).join("");

              donutSvg.innerHTML = arcs + `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="9" fill="var(--dim)" font-family="Roboto Mono,monospace">${entries.length}F</text>`;

              if (legendEl) {
                legendEl.innerHTML = entries.slice(0, 6).map(([fid, v], i) =>
                  `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="display:flex;align-items:center;gap:5px;">
                      <span style="width:8px;height:8px;border-radius:50%;background:${DONUT_COLORS[i % DONUT_COLORS.length]};flex-shrink:0;display:inline-block;"></span>
                      <span style="color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${fundName(fid)}</span>
                    </span>
                    <span style="color:var(--dim);font-family:'Roboto Mono',monospace;">${((v / total) * 100).toFixed(0)}%</span>
                  </div>`
                ).join("");
              }
            }
          }

export function openCurValModal() {
            closeNavDropdowns();
            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10);
            el("curValDate").textContent = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

            const allFunds = [
              ...LIQ_FUNDS.map(f => ({ id: f.id, name: state.liquid[f.id].name || f.defaultName, type: "liq" })),
              ...EQ_FUNDS.map(f => ({ id: f.id, name: state.equity[f.id].name || f.defaultName, type: "eq" })),
            ];

            const listEl = el("curValFundList");
            listEl.innerHTML = allFunds.map(f => {
              const s = f.type === "liq" ? state.liquid[f.id] : state.equity[f.id];
              const afterExpense = f.type === "liq" ? (s.value || 0) : (s.shown || 0);
              const curVal = s.currentValue || afterExpense;
              return `
                <div class="curval-fund-row" data-fundid="${f.id}" data-type="${f.type}">
                  <span class="curval-fname">${f.name}</span>
                  <div class="curval-ibox">
                    <span class="pfx">₹</span>
                    <input type="number" class="curval-inp" id="cvi-${f.id}" data-afterexpense="${afterExpense}" value="${curVal || ""}" min="0" inputmode="numeric" placeholder="0" />
                  </div>
                </div>`;
            }).join("");

            navigateTo("transactions");
            expandTxpCard("txp-curval");
          }

export function closeCurValModal() {
            collapseTxpCard("txp-curval");
          }

export function saveCurVal() {
            const today = new Date().toISOString().slice(0, 10);
            const ts = new Date().toISOString();
            const allFunds = [
              ...LIQ_FUNDS.map(f => ({ id: f.id, type: "liq" })),
              ...EQ_FUNDS.map(f => ({ id: f.id, type: "eq" })),
            ];

            let changed = false;
            allFunds.forEach(f => {
              const inpEl = el("cvi-" + f.id);
              if (!inpEl) return;
              const v = parseFloat(inpEl.value) || 0;
              if (v <= 0) return;
              const s = f.type === "liq" ? state.liquid[f.id] : state.equity[f.id];
              const afterExpense = f.type === "liq" ? (s.value || 0) : (s.shown || 0);
              s.currentValue = v;
              const profit = v - afterExpense;
              const profitPct = afterExpense > 0 ? (profit / afterExpense) * 100 : 0;
              state.returnsLog.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                fundId: f.id,
                date: today,
                ts,
                currentValue: v,
                afterExpense,
                profit,
                profitPct,
              });
              changed = true;
            });

            if (!changed) { UI.toast("warn", "No values entered", 2500); return; }
            saveState();
            scheduleRender();
            closeCurValModal();
            UI.toast("success", "Current values updated", 2500);
          }

export function renderReturns() {
            const container = el("returnsList");
            if (!container) return;
            const logs = [...(state.returnsLog || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
            if (!logs.length) {
              container.innerHTML = `<div class="ret-empty">No return snapshots yet.<br>Use Admin → Add Current Value to record one.</div>`;
              return;
            }
            const months = {};
            logs.forEach(l => {
              const mk = l.date ? l.date.slice(0, 7) : "unknown";
              if (!months[mk]) months[mk] = [];
              months[mk].push(l);
            });
            let html = "";
            Object.entries(months).forEach(([mk, entries]) => {
              const mLabel = mk !== "unknown"
                ? new Date(mk + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })
                : "Unknown Date";
              html += `<div class="ret-month-head">${mLabel}</div>`;
              entries.forEach(l => {
                const name = fundName(l.fundId);
                const isProfit = l.profit >= 0;
                const sign = isProfit ? "+" : "−";
                const dayLabel = l.date !== "unknown" ? new Date(l.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
                html += `<div class="ret-row">
                  <div class="ret-fund">
                    <div class="ret-fname">${name}</div>
                    <div class="ret-date">${dayLabel}</div>
                  </div>
                  <div class="ret-right">
                    <div class="ret-cur">${fmt(l.currentValue)}</div>
                    <div class="ret-profit-lbl ${isProfit ? "up" : "down"}">${sign}${fmt(Math.abs(l.profit))} (${sign}${Math.abs(l.profitPct).toFixed(1)}%)</div>
                  </div>
                </div>`;
              });
            });
            container.innerHTML = html;
          }

export let txnFilter = { preset: "all", fundId: "", dateFrom: "", dateTo: "", sort: "newest" };
