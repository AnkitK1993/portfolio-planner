import { EQ_CATEGORIES, LIQ_CATEGORIES } from "../../core/constants.js";
import { EQ_FUNDS, LIQ_FUNDS, editMode, fundName, saveState, state, syncFundArrays } from "../../core/state.js";
import { UI, toggleColl, updateCollNameReadonly } from "../../core/ui.js";
import { el } from "../../core/dom.js";
import { fmt, fmtNum, num } from "../../core/format.js";
import { render, scheduleRender } from "./render.js";

export function setStatReturn(elId, curVal, invested) {
            const statEl = el(elId);
            if (!statEl) return;
            if (!curVal || curVal <= 0) { statEl.textContent = "—"; statEl.className = "card-stat-val"; return; }
            const profit = curVal - invested;
            const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
            const sign = profit >= 0 ? "+" : "";
            const cls  = profit >= 0 ? "profit" : "loss";
            statEl.className = `card-stat-val ${cls}`;
            statEl.innerHTML = `${sign}${fmt(Math.abs(profit))}<span class="card-stat-pct">(${sign}${profitPct.toFixed(1)}%)</span>`;
          }

export function liqCardHTML(f) {
            const s = state.liquid[f.id];
            return `
            <div class="card liquid">
              <div class="fhead">
                <input class="fundname" id="lname-${f.id}" value="${s.name}" placeholder="${f.defaultName}" />
                <span class="tag liquid">LIQUID</span>
              </div>
              <div class="grid2">
                <div class="field">
                  <label class="flabel" for="lpaid-${f.id}">Invested <span class="txn-lock">via transactions</span></label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num liq txn-driven" id="lpaid-${f.id}" type="text" placeholder="0" inputmode="numeric" value="${fmtNum(s.paid)}" readonly />
                  </div>
                  <div class="fund-split-row" id="lsplit-${f.id}"></div>
                </div>
                <div class="field">
                  <label class="flabel" for="lval-${f.id}">After expense <span class="txn-lock">via transactions</span></label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num liq txn-driven" id="lval-${f.id}" type="text" placeholder="0" inputmode="numeric" value="${fmtNum(s.value)}" readonly />
                  </div>
                </div>
              </div>
              <div class="grid2">
                <div class="field">
                  <label class="flabel">Current Value</label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num liq" id="lcurval-${f.id}" type="text" placeholder="—" readonly />
                  </div>
                </div>
                <div class="field">
                  <label class="flabel">Returns</label>
                  <div class="rtn-display" id="lrtn-${f.id}">—</div>
                  <div class="fund-xirr-line" id="lxirr-inner-${f.id}"></div>
                </div>
              </div>
              <div class="ratechip">Expense ratio: <b id="lrate-${f.id}">—</b></div>
              <div class="grid2">
                <div class="field">
                  <label class="flabel" for="ltgt-${f.id}">Target total</label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num liq" id="ltgt-${f.id}" type="text" placeholder="0" inputmode="numeric" value="${fmtNum(s.target)}" />
                  </div>
                </div>
                <div class="field">
                  <label class="flabel" for="lres-${f.id}">Untouchable reserve</label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num liq" id="lres-${f.id}" type="text" placeholder="0" inputmode="numeric" value="${fmtNum(s.reserve)}" />
                  </div>
                </div>
              </div>
              <div class="chip liq"><span>Deployable</span><b id="ldep-${f.id}">&#8377;0</b></div>
              <div class="chip liq"><span id="linvlbl-${f.id}">Invest now</span><b id="linv-${f.id}">&#8377;0</b></div>
              <div class="pbar-row"><span>Reserved</span><span id="lrespct-${f.id}">0%</span></div>
              <div class="pbar"><div class="fill liq" id="ldepfill-${f.id}" style="width:0%"></div></div>
              <div id="spark-${f.id}" style="margin-top:8px;"></div>
            </div>`;
          }

export function eqCardHTML(f) {
            const s = state.equity[f.id];
            return `
            <div class="card equity">
              <div class="fhead">
                <input class="fundname" id="ename-${f.id}" value="${s.name}" placeholder="${f.defaultName}" />
                <span class="tag equity">EQUITY</span>
              </div>
              <div class="grid2">
                <div class="field">
                  <label class="flabel" for="epaid-${f.id}">Invested <span class="txn-lock">via transactions</span></label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num txn-driven" id="epaid-${f.id}" type="text" placeholder="0" inputmode="numeric" value="${fmtNum(s.paid)}" readonly />
                  </div>
                  <div class="fund-split-row" id="esplit-${f.id}"></div>
                </div>
                <div class="field">
                  <label class="flabel" for="eshown-${f.id}">After expense <span class="txn-lock">via transactions</span></label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num txn-driven" id="eshown-${f.id}" type="text" placeholder="0" inputmode="numeric" value="${fmtNum(s.shown)}" readonly />
                  </div>
                </div>
              </div>
              <div class="grid2">
                <div class="field">
                  <label class="flabel">Current Value</label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num" id="ecurvval-${f.id}" type="text" placeholder="—" readonly />
                  </div>
                </div>
                <div class="field">
                  <label class="flabel">Returns</label>
                  <div class="rtn-display" id="ertn-${f.id}">—</div>
                  <div class="fund-xirr-line" id="exirr-inner-${f.id}"></div>
                </div>
              </div>
              <div class="ratechip">Expense ratio: <b id="erate-${f.id}">—</b></div>
              <div class="field">
                <label class="flabel" for="etgt-${f.id}">Target total</label>
                <div class="ibox"><span class="pfx">&#8377;</span>
                  <input class="num" id="etgt-${f.id}" type="text" placeholder="0" inputmode="numeric" value="${fmtNum(s.target)}" />
                </div>
              </div>
              <div class="chip mint"><span id="einvlbl-${f.id}">Invest now</span><b id="einv-${f.id}">&#8377;0</b></div>
              <div class="sip-divider"></div>
              <div class="sip-row">
                <div class="field">
                  <label class="flabel" for="esip-${f.id}">Monthly SIP</label>
                  <div class="ibox"><span class="pfx">&#8377;</span>
                    <input class="num" id="esip-${f.id}" type="text" placeholder="0" inputmode="numeric" value="${fmtNum(s.sipAmt)}" />
                  </div>
                </div>
                <div class="field date-field">
                  <label class="flabel" for="esipdate-${f.id}">SIP date</label>
                  <input class="num no-pfx" id="esipdate-${f.id}" type="number" min="1" max="28" placeholder="5" inputmode="numeric" value="${s.sipDate || ""}" />
                </div>
                <div class="sip-pct" id="esippct-${f.id}">0%</div>
              </div>
              <div class="chip amber" id="estpchip-${f.id}" style="display:none;margin-top:8px">
                <span>Monthly STP</span><b id="estp-${f.id}">&#8377;0</b>
              </div>
              <div id="spark-${f.id}" style="margin-top:8px;"></div>
            </div>`;
          }

export function bindFundEvents() {
            [...LIQ_FUNDS, ...EQ_FUNDS].forEach(f => {
              const head = el("coll-head-" + f.id);
              if (head) head.addEventListener("click", () => toggleColl(f.id));
            });
            LIQ_FUNDS.forEach(f => {
              const inp = el("coll-name-" + f.id);
              if (!inp) return;
              inp.addEventListener("mousedown", e => { if (editMode) e.stopPropagation(); });
              inp.addEventListener("click",     e => { if (editMode) e.stopPropagation(); });
              inp.addEventListener("input", e => { state.liquid[f.id].label = e.target.value; });
            });
            EQ_FUNDS.forEach(f => {
              const inp = el("coll-name-" + f.id);
              if (!inp) return;
              inp.addEventListener("mousedown", e => { if (editMode) e.stopPropagation(); });
              inp.addEventListener("click",     e => { if (editMode) e.stopPropagation(); });
              inp.addEventListener("input", e => { state.equity[f.id].label = e.target.value; });
            });
            LIQ_FUNDS.forEach(f => {
              el("lname-"    + f.id)?.addEventListener("input", e => { state.liquid[f.id].name = e.target.value; scheduleRender(); });
              el("lpaid-"    + f.id)?.addEventListener("input", e => { state.liquid[f.id].paid = num(e.target.value); scheduleRender(); });
              el("lval-"     + f.id)?.addEventListener("input", e => { state.liquid[f.id].value = num(e.target.value); scheduleRender(); });
              el("lres-"     + f.id)?.addEventListener("input", e => { state.liquid[f.id].reserve = num(e.target.value); scheduleRender(); });
              el("ltgt-"     + f.id)?.addEventListener("input", e => { state.liquid[f.id].target = num(e.target.value); scheduleRender(); });
            });
            EQ_FUNDS.forEach(f => {
              el("ename-"    + f.id)?.addEventListener("input", e => { state.equity[f.id].name = e.target.value; scheduleRender(); });
              el("epaid-"    + f.id)?.addEventListener("input", e => { state.equity[f.id].paid = num(e.target.value); scheduleRender(); });
              el("eshown-"   + f.id)?.addEventListener("input", e => { state.equity[f.id].shown = num(e.target.value); scheduleRender(); });
              el("etgt-"     + f.id)?.addEventListener("input", e => { state.equity[f.id].target = num(e.target.value); scheduleRender(); });
              el("esip-"     + f.id)?.addEventListener("input", e => { state.equity[f.id].sipAmt = num(e.target.value); scheduleRender(); });
              el("esipdate-" + f.id)?.addEventListener("input", e => { state.equity[f.id].sipDate = num(e.target.value) || 5; scheduleRender(); });
            });
            /* Format with commas on blur, strip on focus for editable money fields */
            const moneyIds = [
              ...LIQ_FUNDS.flatMap(f => ["lres-"+f.id, "ltgt-"+f.id]),
              ...EQ_FUNDS.flatMap(f => ["etgt-"+f.id, "esip-"+f.id]),
            ];
            moneyIds.forEach(id => {
              const inp = el(id);
              if (!inp) return;
              inp.addEventListener("focus", () => { const v = num(inp.value); inp.value = v > 0 ? v : ""; });
              inp.addEventListener("blur",  () => { inp.value = fmtNum(num(inp.value)); });
            });
          }

export function makeFundSection(f, isLiq, container) {
            const s = isLiq ? state.liquid[f.id] : state.equity[f.id];
            if (!s) return;
            const lbl = s.label || f.defaultName;
            const cats = isLiq ? LIQ_CATEGORIES : EQ_CATEGORIES;
            const cat  = s.category || "";
            const catOpts = cats.map(c => `<option value="${c}"${c === cat ? " selected" : ""}>${c}</option>`).join("");
            const sec = document.createElement("div");
            sec.className = "coll-section";
            sec.dataset.fundId   = f.id;
            sec.dataset.fundType = isLiq ? "liq" : "eq";
            sec.innerHTML = `
              <button class="coll-head" id="coll-head-${f.id}" aria-expanded="false">
                <span class="drag-handle" title="Drag to reorder">⠿</span>
                <input class="coll-title coll-name-input" id="coll-name-${f.id}" value="${lbl}" ${editMode ? "" : "readonly"} />
                ${cat ? `<span class="fund-cat-pill">${cat}</span>` : `<span class="fund-cat-pill" style="display:none"></span>`}
                <select class="fund-cat-select" id="cat-${f.id}"><option value="">Category…</option>${catOpts}</select>
                <span class="coll-meta" id="coll-val-${f.id}"></span>
                <span class="coll-rtn" id="coll-rtn-${f.id}"></span>
                <span class="coll-xirr" id="coll-xirr-${f.id}" style="display:none"></span>
                <button class="fund-archive-btn" data-id="${f.id}" data-liq="${isLiq}" title="Archive fund">Archive</button>
                <span class="coll-chevron">▾</span>
              </button>
              <div class="coll-body" id="coll-body-${f.id}">
                <div class="coll-body-inner" id="${isLiq ? "liq" : "eq"}-wrap-${f.id}"></div>
              </div>`;
            container.appendChild(sec);
            el((isLiq ? "liq" : "eq") + "-wrap-" + f.id).innerHTML = isLiq ? liqCardHTML(f) : eqCardHTML(f);

            // Category change
            const catSel = el("cat-" + f.id);
            catSel.addEventListener("change", e => {
              e.stopPropagation();
              s.category = e.target.value;
              const pill = sec.querySelector(".fund-cat-pill");
              if (e.target.value) { pill.textContent = e.target.value; pill.style.display = ""; }
              else pill.style.display = "none";
              saveState();
            });
            catSel.addEventListener("click", e => e.stopPropagation());
            catSel.addEventListener("mousedown", e => e.stopPropagation());

            // Archive button
            const archBtn = sec.querySelector(".fund-archive-btn");
            archBtn.addEventListener("click", e => {
              e.stopPropagation();
              const isLiqF = e.currentTarget.dataset.liq === "true";
              const fid = e.currentTarget.dataset.id;
              UI.confirm(`Archive "${fundName(fid)}"? It will be hidden but data is preserved.`, "Archive fund?", "Archive", () => {
                (isLiqF ? state.liquid : state.equity)[fid].archived = true;
                saveState(); syncFundArrays(); rebuildFundCollapsibles(); render();
              });
            });

            // Drag-to-reorder
            sec.setAttribute("draggable", "true");
            sec.addEventListener("dragstart", e => {
              e.dataTransfer.setData("text/plain", f.id + "|" + (isLiq ? "liq" : "eq"));
              sec.style.opacity = "0.5";
            });
            sec.addEventListener("dragend", () => { sec.style.opacity = ""; container.querySelectorAll(".coll-section").forEach(s2 => s2.classList.remove("drag-over")); });
            sec.addEventListener("dragover", e => { e.preventDefault(); sec.classList.add("drag-over"); });
            sec.addEventListener("dragleave", () => sec.classList.remove("drag-over"));
            sec.addEventListener("drop", e => {
              e.preventDefault();
              sec.classList.remove("drag-over");
              const [dragId, dragType] = (e.dataTransfer.getData("text/plain") || "").split("|");
              if (!dragId || dragType !== (isLiq ? "liq" : "eq") || dragId === f.id) return;
              const orderKey = isLiq ? "liquidOrder" : "equityOrder";
              const order = [...(state[orderKey] || (isLiq ? LIQ_FUNDS : EQ_FUNDS).map(x => x.id))];
              const fromIdx = order.indexOf(dragId);
              const toIdx   = order.indexOf(f.id);
              if (fromIdx < 0 || toIdx < 0) return;
              order.splice(fromIdx, 1);
              order.splice(toIdx, 0, dragId);
              state[orderKey] = order;
              saveState(); syncFundArrays(); rebuildFundCollapsibles(); render();
            });
          }

export function rebuildFundCollapsibles() {
            const liqContainer = el("liqFundsList");
            const eqContainer  = el("eqFundsList");
            liqContainer.innerHTML = "";
            eqContainer.innerHTML  = "";
            LIQ_FUNDS.forEach(f => {
              if (!state.liquid[f.id]) state.liquid[f.id] = { name: f.defaultName, label: f.defaultName, paid: 0, value: 0, reserve: 0, target: 0 };
              makeFundSection(f, true, liqContainer);
            });
            EQ_FUNDS.forEach(f => {
              if (!state.equity[f.id]) state.equity[f.id] = { name: f.defaultName, label: f.defaultName, paid: 0, shown: 0, target: 0, sipAmt: 0, sipDate: 5, sipPaidAmounts: {} };
              makeFundSection(f, false, eqContainer);
            });

            // Render archived funds list
            const archivedEl = el("archivedList");
            if (archivedEl) {
              const allLiqIds = state.liquidOrder || Object.keys(state.liquid);
              const allEqIds  = state.equityOrder || Object.keys(state.equity);
              const archivedFunds = [
                ...allLiqIds.filter(id => state.liquid[id]?.archived).map(id => ({ id, name: state.liquid[id].name || id, isLiq: true })),
                ...allEqIds.filter(id => state.equity[id]?.archived).map(id => ({ id, name: state.equity[id].name || id, isLiq: false })),
              ];
              archivedEl.innerHTML = archivedFunds.length
                ? archivedFunds.map(f => `<div class="archived-fund-row">
                    <span class="archived-fund-name">${f.name} <span style="font-size:9px;color:var(--dim)">(${f.isLiq ? "Liquid" : "Equity"})</span></span>
                    <button class="unarchive-btn" data-id="${f.id}" data-liq="${f.isLiq}">Restore</button>
                  </div>`).join("")
                : `<div style="font-size:11px;color:var(--dim);">No archived funds.</div>`;
              archivedEl.querySelectorAll(".unarchive-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                  const fid = btn.dataset.id;
                  const isLiqF = btn.dataset.liq === "true";
                  (isLiqF ? state.liquid : state.equity)[fid].archived = false;
                  saveState(); syncFundArrays(); rebuildFundCollapsibles(); render();
                });
              });
            }

            bindFundEvents();
            updateCollNameReadonly();
          }

export function fundRowHTML(fundId, name, value) {
            return `
              <div class="curval-fund-row" data-fundid="${fundId}">
                <span class="curval-fname">${name}</span>
                <div class="curval-ibox">
                  <span class="pfx">&#8377;</span>
                  <input type="number" class="curval-inp" id="txi-${fundId}" min="0" inputmode="numeric" placeholder="0" value="${value || ""}" />
                </div>
              </div>`;
          }

export const PROFIT_MILESTONES = [50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000];

export function checkProfitMilestones(totalProfit) {
            if (totalProfit <= 0) return;
            PROFIT_MILESTONES.forEach(m => {
              if (totalProfit >= m && !_shownMilestones.includes(m)) {
                _shownMilestones.push(m);
                localStorage.setItem("shownMilestones", JSON.stringify(_shownMilestones));
                const label = m >= 10000000 ? "₹1 Crore" : m >= 100000 ? "₹" + (m / 100000) + " Lakh" : "₹" + (m / 1000) + "K";
                UI.toast("success", `🎉 Milestone! Profit crossed ${label}`, 5000);
              }
            });
          }

export let _shownMilestones = JSON.parse(localStorage.getItem("shownMilestones") || "[]");
