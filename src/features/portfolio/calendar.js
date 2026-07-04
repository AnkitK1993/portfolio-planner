import { EQ_FUNDS, LIQ_FUNDS, getFundName, saveState, state } from "../../core/state.js";
import { UI } from "../../core/ui.js";
import { el } from "../../core/dom.js";
import { fundRowHTML } from "./funds.js";
import { num } from "../../core/format.js";
import { scheduleRender } from "./render.js";
import { syncInputsFromState } from "../../infra/firebase.js";

export let calYear  = new Date().getFullYear();

export function setCalYear(v) { calYear = v; }

export let calMonth = new Date().getMonth();

export function setCalMonth(v) { calMonth = v; }

export let calView  = "month";

export function setCalView(v) { calView = v; }

export let calWeekOffset = 0;

export function setCalWeekOffset(v) { calWeekOffset = v; }

export let calDayDate = null;

export function noteStatus(dateStr) {
            const today = new Date().toISOString().split("T")[0];
            if (dateStr > today) return "future";
            if (dateStr === today) return "today";
            return "past";
          }

export function buildCalEvtMap(dates) {
            // dates is an array of "YYYY-MM-DD" strings in scope
            const monthPrefixes = [...new Set(dates.map(d => d.slice(0,7)))];
            const evtMap = {};
            (state.transactions || []).forEach(t => {
              if (!evtMap[t.date]) evtMap[t.date] = { txns: [], notes: [], sips: [] };
              evtMap[t.date].txns.push(t);
            });
            (state.calendarNotes || []).forEach(n => {
              if (!evtMap[n.date]) evtMap[n.date] = { txns: [], notes: [], sips: [] };
              evtMap[n.date].notes.push(n);
            });
            monthPrefixes.forEach(mp => {
              const dim = new Date(+mp.slice(0,4), +mp.slice(5,7), 0).getDate();
              [...LIQ_FUNDS, ...EQ_FUNDS].forEach(f => {
                const s = LIQ_FUNDS.some(x => x.id === f.id) ? state.liquid[f.id] : state.equity[f.id];
                const sipAmt = s.sipAmt || 0; const sipDay = parseInt(s.sipDate) || 0;
                if (sipAmt > 0 && sipDay >= 1 && sipDay <= dim) {
                  const ds = `${mp}-${String(sipDay).padStart(2,"0")}`;
                  if (!evtMap[ds]) evtMap[ds] = { txns: [], notes: [], sips: [] };
                  evtMap[ds].sips.push({ fundId: f.id, amount: sipAmt });
                }
              });
            });
            return evtMap;
          }

export function calDayHTML(ds, evtMap, today, extraClass = "") {
            const evts = evtMap[ds] || { txns: [], notes: [], sips: [] };
            const isToday = ds === today;
            const d = ds.slice(8);
            let dots = "";
            if (evts.txns.length) dots += `<span class="cal-dot green"></span>`;
            evts.notes.forEach(n => {
              const dc = noteStatus(n.date) === "future" ? "green" : noteStatus(n.date) === "today" ? "orange" : "red";
              dots += `<span class="cal-dot ${dc}"></span>`;
            });
            if (evts.sips.length) dots += `<span class="cal-dot sip"></span>`;
            return `<div class="cal-day${isToday ? " today" : ""}${extraClass ? " " + extraClass : ""}" data-date="${ds}">
              <span class="cal-dn">${parseInt(d)}</span>
              <div class="cal-dots">${dots}</div>
            </div>`;
          }

export function renderCalendar() {
            const grid = el("calGrid");
            if (!grid) return;
            const today = new Date().toISOString().split("T")[0];

            if (calView === "week") {
              // Week view: show 7 days for the current week
              const baseDate = new Date();
              baseDate.setDate(baseDate.getDate() + calWeekOffset * 7);
              const weekStart = new Date(baseDate);
              weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
              const dates = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                return d.toISOString().split("T")[0];
              });

              const evtMap = buildCalEvtMap(dates);
              const weekLbl = `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ` +
                new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
              el("calMonthLabel").textContent = weekLbl;

              const weekTotal = dates.reduce((s, ds) => s + (evtMap[ds]?.txns || []).reduce((t, x) => t + (x.invested || 0), 0), 0);
              const investedEl = el("calMonthInvested");
              if (investedEl) investedEl.textContent = weekTotal > 0 ? "₹" + Math.round(weekTotal).toLocaleString("en-IN") : "";

              // Week view: single row of 7 cells with day labels
              const dayNames = ["Su","Mo","Tu","We","Th","Fr","Sa"];
              const wdEl = el("calWeekdays");
              if (wdEl) wdEl.style.display = "grid";

              let html = "";
              dates.forEach(ds => { html += calDayHTML(ds, evtMap, today, "week-cell"); });
              grid.style.gridTemplateColumns = "repeat(7, 1fr)";
              grid.innerHTML = html;
            } else {
              // Month view
              const firstDay = new Date(calYear, calMonth, 1).getDay();
              const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
              const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
              const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2,"0")}`;

              const allDates = Array.from({ length: daysInMonth }, (_, i) =>
                `${monthPrefix}-${String(i + 1).padStart(2,"0")}`);
              const evtMap = buildCalEvtMap(allDates);

              el("calMonthLabel").textContent = new Date(calYear, calMonth, 1)
                .toLocaleString("en-IN", { month: "long", year: "numeric" });

              const monthTotal = (state.transactions || [])
                .filter(t => t.date && t.date.startsWith(monthPrefix))
                .reduce((s, t) => s + (t.invested || 0), 0);
              const investedEl = el("calMonthInvested");
              if (investedEl) investedEl.textContent = monthTotal > 0 ? "₹" + Math.round(monthTotal).toLocaleString("en-IN") : "";

              grid.style.gridTemplateColumns = "";
              let html = "";
              for (let i = firstDay - 1; i >= 0; i--) {
                html += `<div class="cal-day other-month"><span class="cal-dn">${prevMonthDays - i}</span></div>`;
              }
              allDates.forEach(ds => { html += calDayHTML(ds, evtMap, today); });
              grid.innerHTML = html;
            }

            grid.querySelectorAll(".cal-day:not(.other-month)").forEach(cell => {
              cell.addEventListener("click", () => openCalDay(cell.dataset.date));
            });
          }

export function openCalDay(dateStr) {
            calDayDate = dateStr;
            const d = new Date(dateStr + "T00:00:00");
            el("calDayTitle").textContent = d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
            refreshCalDayBody(dateStr);
            el("calDayModal").style.display = "flex";
          }

export function refreshCalDayBody(dateStr) {
            const txns  = (state.transactions  || []).filter(t => t.date === dateStr);
            const notes = (state.calendarNotes || []).filter(n => n.date === dateStr);
            const dayOfMonth = parseInt(dateStr.split("-")[2]);
            const sipEvts = [];
            [...LIQ_FUNDS, ...EQ_FUNDS].forEach(f => {
              const s = LIQ_FUNDS.some(x => x.id === f.id) ? state.liquid[f.id] : state.equity[f.id];
              if ((s.sipAmt || 0) > 0 && parseInt(s.sipDate) === dayOfMonth) {
                sipEvts.push({ fundId: f.id, amount: s.sipAmt });
              }
            });
            let html = "";
            if (!txns.length && !notes.length && !sipEvts.length) {
              html = `<p style="color:var(--dim);font-size:12px;padding:8px 0">No events on this day.</p>`;
            }
            txns.forEach(t => {
              html += `<div class="calday-row">
                <div class="calday-info">
                  <span class="calday-fund">${getFundName(t.fundId)}</span>
                  <span class="calday-amt calday-green">&#8377;${Math.round(t.invested).toLocaleString("en-IN")}</span>
                </div>
                <span class="calday-badge green-b">Invested</span>
              </div>`;
            });
            sipEvts.forEach(s => {
              html += `<div class="calday-row">
                <div class="calday-info">
                  <span class="calday-fund">${getFundName(s.fundId)}</span>
                  <span class="calday-amt calday-cyan">&#8377;${Math.round(s.amount).toLocaleString("en-IN")}</span>
                  <span class="calday-note-text">Monthly SIP</span>
                </div>
                <span class="calday-badge sip-b">SIP</span>
              </div>`;
            });
            notes.forEach(n => {
              const st = noteStatus(n.date);
              const amtCls   = st === "future" ? "calday-green" : st === "today" ? "calday-orange" : "calday-red";
              const badgeCls = st === "future" ? "green-b" : st === "today" ? "orange-b" : "red-b";
              const label    = st === "future" ? "Scheduled" : st === "today" ? "Due Today" : "Overdue";
              // Support both new (funds[]) and legacy (fundId/amount) format
              const noteFunds = n.funds || (n.fundId ? [{ fundId: n.fundId, amount: n.amount }] : []);
              const actions = `<div class="calday-actions">
                <span class="calday-badge ${badgeCls}">${label}</span>
                <button class="calday-btn" onclick="openCalNoteModal('${n.date}','${n.id}')">Edit</button>
                <button class="calday-btn" onclick="doneCalNote('${n.id}')">Done</button>
                <button class="calday-btn danger" onclick="deleteCalNote('${n.id}')">Delete</button>
              </div>`;
              noteFunds.forEach(({ fundId, amount }, i) => {
                html += `<div class="calday-row">
                  <div class="calday-info">
                    <span class="calday-fund">${getFundName(fundId)}</span>
                    <span class="calday-amt ${amtCls}">&#8377;${Math.round(amount || 0).toLocaleString("en-IN")}</span>
                    ${i === 0 && n.note ? `<span class="calday-note-text">${n.note}</span>` : ""}
                  </div>
                  ${i === 0 ? actions : ""}
                </div>`;
              });
            });
            el("calDayBody").innerHTML = html;
          }

export function openCalNoteModal(dateStr, noteId) {
            el("calNoteEditId").value = noteId || "";
            el("calNoteModalTitle").textContent = noteId ? "Edit Scheduled" : "Schedule Transaction";
            const today = new Date().toISOString().split("T")[0];
            const allFunds = [
              ...LIQ_FUNDS.map(f => ({ id: f.id, name: state.liquid[f.id]?.name || f.defaultName })),
              ...EQ_FUNDS.map(f => ({ id: f.id, name: state.equity[f.id]?.name || f.defaultName })),
            ];
            // Build prefill map from existing note
            const prefill = {};
            if (noteId) {
              const n = (state.calendarNotes || []).find(x => x.id === noteId);
              if (n) {
                el("calNoteDate").value = n.date;
                el("calNoteText").value = n.note || "";
                (n.funds || (n.fundId ? [{ fundId: n.fundId, amount: n.amount }] : []))
                  .forEach(({ fundId, amount }) => { prefill[fundId] = amount; });
              }
            } else {
              el("calNoteDate").value = dateStr || today;
              el("calNoteText").value = "";
            }
            el("calNoteFundList").innerHTML = allFunds
              .map(f => fundRowHTML(f.id, f.name, prefill[f.id] ? Math.round(prefill[f.id]) : ""))
              .join("");
            el("calDayModal").style.display = "none";
            el("calNoteModal").style.display = "flex";
          }

export function closeCalNoteModal() {
            el("calNoteModal").style.display = "none";
          }

export function saveCalNote() {
            const date   = el("calNoteDate").value;
            const note   = el("calNoteText").value.trim();
            const editId = el("calNoteEditId").value;
            if (!date) { UI.toast("error", "Date is required", 2500); return; }
            // Collect amounts from all fund rows
            const allFunds = [...LIQ_FUNDS, ...EQ_FUNDS];
            const funds = [];
            allFunds.forEach(f => {
              const v = num(el("txi-" + f.id)?.value);
              if (v > 0) funds.push({ fundId: f.id, amount: v });
            });
            if (!funds.length) { UI.toast("warn", "Enter at least one amount", 2500); return; }
            if (!state.calendarNotes) state.calendarNotes = [];
            if (editId) {
              const n = state.calendarNotes.find(x => x.id === editId);
              if (n) { n.date = date; n.funds = funds; n.note = note; delete n.fundId; delete n.amount; }
            } else {
              state.calendarNotes.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
                date, funds, note
              });
            }
            // Target = scheduled amount + current After Expense value
            funds.forEach(({ fundId, amount }) => {
              const isLiq = LIQ_FUNDS.some(f => f.id === fundId);
              const afterExp = isLiq ? (state.liquid[fundId].value || 0) : (state.equity[fundId].shown || 0);
              if (isLiq) state.liquid[fundId].target = amount + afterExp;
              else state.equity[fundId].target = amount + afterExp;
            });
            saveState();
            renderCalendar();
            syncInputsFromState();
            scheduleRender();
            closeCalNoteModal();
            UI.toast("success", editId ? "Updated" : "Scheduled", 1800);
          }

export function noteFundIds(note) {
            return (note.funds || (note.fundId ? [{ fundId: note.fundId }] : []))
              .map(f => f.fundId);
          }

export function recalcFundTarget(fundId) {
            const today = new Date().toISOString().split("T")[0];
            const isLiq  = LIQ_FUNDS.some(f => f.id === fundId);
            const s      = isLiq ? state.liquid[fundId] : state.equity[fundId];
            const afterExp = isLiq ? (s.value || 0) : (s.shown || 0);

            // Next upcoming calendar note for this fund (earliest date >= today)
            const upcoming = (state.calendarNotes || [])
              .filter(n => {
                if (n.date < today) return false;
                const fds = n.funds || (n.fundId ? [{ fundId: n.fundId, amount: n.amount }] : []);
                return fds.some(f => f.fundId === fundId);
              })
              .sort((a, b) => a.date.localeCompare(b.date));

            if (upcoming.length > 0) {
              const fds = upcoming[0].funds || [{ fundId: upcoming[0].fundId, amount: upcoming[0].amount }];
              const entry = fds.find(f => f.fundId === fundId);
              if (entry) { s.target = entry.amount + afterExp; return; }
            }

            // Fall back to monthly SIP amount
            const sipAmt = s.sipAmt || 0;
            if (sipAmt > 0) { s.target = sipAmt + afterExp; return; }

            // Nothing left — leave target as-is
          }

export function removeCalNote(id, successMsg) {
            const note = (state.calendarNotes || []).find(n => n.id === id);
            const affected = note ? noteFundIds(note) : [];
            state.calendarNotes = (state.calendarNotes || []).filter(n => n.id !== id);
            affected.forEach(recalcFundTarget);
            saveState();
            syncInputsFromState();
            scheduleRender();
            renderCalendar();
            if (calDayDate) refreshCalDayBody(calDayDate);
            UI.toast("success", successMsg, 1800);
          }

export function doneCalNote(id) {
            removeCalNote(id, "Marked done");
          }

export function deleteCalNote(id) {
            UI.confirm("This scheduled transaction will be removed.", "Delete?", "Delete", () => {
              removeCalNote(id, "Deleted");
            });
          }
