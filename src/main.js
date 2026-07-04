import "./styles/base.css";
import "./styles/themes.css";
import "./styles/components.css";

import { EQ_FUNDS, LIQ_FUNDS, editMode, privacyMode, saveState, setEditMode, setPrivacyMode, snapshotKey, state, syncFundArrays, toggleEditMode } from "./core/state.js";
import { NW_FIELDS } from "./core/constants.js";
import { UI, closeNavDropdowns, collapseTxpCard, navigateTo, openNavDropdown, toggleColl } from "./core/ui.js";
import { _hasLocalData, authUser, fbAuthReady, fbEnabled, handleSignInResult, initFirebase, loadBackupList, resetBackupPanel, saveManualBackup } from "./infra/firebase.js";
import { _upcomingHead } from "./features/portfolio/upcoming.js";
import { animateNumber } from "./core/animate.js";
import { applyTxnTotals, closeCurValModal, closeTxnModal, openCurValModal, openTxnModal, renderReturns, renderTxns, saveCurVal, saveTxn, setTxnType, txnFilter } from "./features/transactions/index.js";
import { buildNwGrid, nwLiveSaved, renderNetWorth, renderNwHistory, renderNwLineChart, renderNwProjection, setNwEditingKey, setNwLiveSaved, takeSnapshot } from "./features/networth/index.js";
import { buildThemeMatrix, hideThemeMatrix, loadSavedAccent, showThemeMatrix, themeMatrixOpen } from "./features/admin/themes.js";
import { calDayDate, calMonth, calView, calWeekOffset, calYear, closeCalNoteModal, openCalNoteModal, renderCalendar, saveCalNote, setCalMonth, setCalView, setCalWeekOffset, setCalYear } from "./features/portfolio/calendar.js";
import { el } from "./core/dom.js";
import { exportData, importData } from "./features/admin/data.js";
import { fcInflEl, fcShowAllEl, fcStepUpEl, renderForecast } from "./features/forecast/index.js";
import { fmtMonth, num } from "./core/format.js";
import { openManageSips, saveManageSips } from "./features/portfolio/sips.js";
import { rebuildFundCollapsibles } from "./features/portfolio/funds.js";
import { render } from "./features/portfolio/render.js";

import "./features/admin/pin.js";

el("homeBtn").addEventListener("click", () => navigateTo("portfolio"));
el("summaryBtn").addEventListener("click", () => {
            if (!authUser) { UI.toast("err", "Unauthorized — please sign in to access this section", 4000); return; }
            navigateTo("summary");
          });
el("networthBtn").addEventListener("click", () => {
            if (!authUser) { UI.toast("err", "Unauthorized — please sign in to access this section", 4000); return; }
            navigateTo("networth");
          });
el("ddForecastBtn").addEventListener("click", () => {
            if (!authUser) { closeNavDropdowns(); UI.toast("err", "Unauthorized — please sign in to access this section", 4000); return; }
            navigateTo("forecast");
          });
el("adminBtn").addEventListener("click", e => { e.stopPropagation(); openNavDropdown("adminDropdown", el("adminBtn")); });
document.addEventListener("click", e => {
            if (!e.target.closest("#adminDropdown")) closeNavDropdowns();
          });
el("txnsBtn").addEventListener("click", () => { navigateTo("transactions"); });
el("ddDataBtn").addEventListener("click", () => { closeNavDropdowns(); el("dataModal").style.display = "flex"; });
["txp-addtxn", "txp-history", "txp-curval", "txp-sip"].forEach(id => {
            const head = el(id + "-head");
            if (!head) return;
            head.addEventListener("click", () => {
              const card = el(id);
              const willOpen = !card.classList.contains("open");
              card.classList.toggle("open");
              if (willOpen) {
                if (id === "txp-addtxn") openTxnModal();
                if (id === "txp-curval") openCurValModal();
                if (id === "txp-sip") openManageSips();
              }
            });
          });
el("ddPinBtn").addEventListener("click", () => {
            closeNavDropdowns();
            const hasPIN = !!localStorage.getItem("appPin");
            const msg = hasPIN ? "Enter a new 4-digit PIN (or leave blank to clear PIN lock):" : "Enter a 4-digit PIN to lock the app:";
            const raw = prompt(msg);
            if (raw === null) return; // cancelled
            if (raw.trim() === "") { window.clearAppPin(); }
            else { window.setAppPin(raw.trim()); }
          });
el("dataModalClose").addEventListener("click", () => { el("dataModal").style.display = "none"; });
el("dataModalCancelBtn").addEventListener("click", () => { el("dataModal").style.display = "none"; });
el("dataModal").addEventListener("click", e => { if (e.target === el("dataModal")) el("dataModal").style.display = "none"; });
el("ddRebalanceBtn").addEventListener("click", () => { closeNavDropdowns(); navigateTo("rebalance"); });
el("dataExportBtn").addEventListener("click", exportData);
el("dataImportBtn").addEventListener("click", () => el("dataImportFile").click());
el("dataImportFile").addEventListener("change", importData);
el("backupNowBtn").addEventListener("click", saveManualBackup);
el("backupBrowseBtn").addEventListener("click", loadBackupList);
el("dataModalClose").addEventListener("click", resetBackupPanel);
el("dataModalCancelBtn").addEventListener("click", resetBackupPanel);
el("curValCancelBtn").addEventListener("click", closeCurValModal);
el("curValSaveBtn").addEventListener("click", saveCurVal);
el("txnTabInvest").addEventListener("click", () => {
            el("txnTabInvest").classList.add("active");
            el("txnTabReturns").classList.remove("active");
            el("txnList").style.display = "";
            el("txnSummary").style.display = "";
            el("txnFilters").style.display = "";
            el("returnsList").style.display = "none";
            renderTxns();
          });
el("txnTabReturns").addEventListener("click", () => {
            el("txnTabReturns").classList.add("active");
            el("txnTabInvest").classList.remove("active");
            el("txnList").style.display = "none";
            el("txnSummary").style.display = "none";
            el("txnFilters").style.display = "none";
            el("returnsList").style.display = "";
            renderReturns();
          });
el("txnCancelBtn").addEventListener("click", closeTxnModal);
el("txnSaveBtn").addEventListener("click", saveTxn);
el("txnTypeToggle").addEventListener("click", e => {
            const btn = e.target.closest(".txn-type-btn");
            if (btn) setTxnType(btn.dataset.type);
          });
document.querySelectorAll("#txnPresets .txn-preset").forEach(btn => {
            btn.addEventListener("click", () => {
              document.querySelectorAll("#txnPresets .txn-preset").forEach(b => b.classList.remove("active"));
              btn.classList.add("active");
              txnFilter.preset = btn.dataset.preset;
              el("txnDateFrom").value = "";
              el("txnDateTo").value = "";
              txnFilter.dateFrom = "";
              txnFilter.dateTo = "";
              renderTxns();
            });
          });
el("txnFundFilter").addEventListener("change", () => {
            txnFilter.fundId = el("txnFundFilter").value;
            renderTxns();
          });
el("txnDateFrom").addEventListener("change", () => {
            txnFilter.dateFrom = el("txnDateFrom").value;
            document.querySelectorAll("#txnPresets .txn-preset").forEach(b => b.classList.remove("active"));
            txnFilter.preset = "custom";
            renderTxns();
          });
el("txnDateTo").addEventListener("change", () => {
            txnFilter.dateTo = el("txnDateTo").value;
            document.querySelectorAll("#txnPresets .txn-preset").forEach(b => b.classList.remove("active"));
            txnFilter.preset = "custom";
            renderTxns();
          });
el("txnSortSel").addEventListener("change", () => {
            txnFilter.sort = el("txnSortSel").value;
            renderTxns();
          });
el("editToggleBtn").addEventListener("click", () => { closeNavDropdowns(); toggleEditMode(); });
el("calPrev").addEventListener("click", () => {
            if (calView === "week") { setCalWeekOffset(calWeekOffset - 1); renderCalendar(); return; }
            setCalMonth(calMonth - 1); if (calMonth < 0) { setCalMonth(11); setCalYear(calYear - 1); } renderCalendar();
          });
el("calNext").addEventListener("click", () => {
            if (calView === "week") { setCalWeekOffset(calWeekOffset + 1); renderCalendar(); return; }
            setCalMonth(calMonth + 1); if (calMonth > 11) { setCalMonth(0); setCalYear(calYear + 1); } renderCalendar();
          });
el("calViewMonth").addEventListener("click", () => {
            setCalView("month");
            el("calViewMonth").classList.add("active"); el("calViewWeek").classList.remove("active");
            renderCalendar();
          });
el("calViewWeek").addEventListener("click", () => {
            setCalView("week"); setCalWeekOffset(0);
            el("calViewWeek").classList.add("active"); el("calViewMonth").classList.remove("active");
            renderCalendar();
          });
el("calDayClose").addEventListener("click", () => { el("calDayModal").style.display = "none"; });
el("calDayCloseBtn").addEventListener("click", () => { el("calDayModal").style.display = "none"; });
el("calDayAddBtn").addEventListener("click", () => openCalNoteModal(calDayDate, null));
el("calDayModal").addEventListener("click", e => { if (e.target === el("calDayModal")) el("calDayModal").style.display = "none"; });
el("calNoteClose").addEventListener("click", closeCalNoteModal);
el("calNoteCancelBtn").addEventListener("click", closeCalNoteModal);
el("calNoteSaveBtn").addEventListener("click", saveCalNote);
el("calNoteModal").addEventListener("click", e => { if (e.target === el("calNoteModal")) closeCalNoteModal(); });
el("sipModalCancelBtn").addEventListener("click", () => collapseTxpCard("txp-sip"));
el("sipModalSaveBtn").addEventListener("click", saveManageSips);
el("ddAuthBtn").addEventListener("click", async () => {
            if (!fbAuthReady) {
              UI.toast("err", "Firebase still connecting — try again in a moment", 3000);
              return;
            }
            closeNavDropdowns();
            if (authUser) {
              await firebase.auth().signOut()
                .catch(e => UI.toast("err", "Sign-out failed: " + e.message, 4000));
            } else {
              const provider = new firebase.auth.GoogleAuthProvider();
              try {
                const result = await firebase.auth().signInWithPopup(provider);
                handleSignInResult(result);
              } catch (e) {
                const ignored = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];
                if (ignored.includes(e.code)) return;
                // Popups are blocked/unsupported on many mobile browsers & in-app
                // webviews — fall back to a full-page redirect flow instead.
                const fallbackToRedirect = [
                  "auth/popup-blocked",
                  "auth/operation-not-supported-in-this-environment",
                  "auth/web-storage-unsupported",
                  "auth/internal-error",
                ];
                if (fallbackToRedirect.includes(e.code)) {
                  firebase.auth().signInWithRedirect(provider)
                    .catch(e2 => UI.toast("err", e2.message || "Sign-in failed", 5000));
                } else {
                  UI.toast("err", e.message || "Sign-in failed", 5000);
                }
              }
            }
          });
el("ddThemeBtn").addEventListener("click", e => {
            e.stopPropagation();
            closeNavDropdowns();
            if (themeMatrixOpen) { hideThemeMatrix(); } else { showThemeMatrix(el("adminBtn")); }
          });
animateNumber._ctr = 0;
(function restoreFcState() {
            const fc = state.forecast || {};
            const mode = fc.mode || "project";
            document.querySelectorAll(".fc-mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
            const sc = fc.fcScenario || "base";
            document.querySelectorAll(".fc-scenario-btn").forEach(b => b.classList.toggle("active", b.dataset.sc === sc));
            if (fc.stepUp && el("fcStepUp")) el("fcStepUp").value = fc.stepUp;
            if (fc.useInflation && el("fcInflation")) el("fcInflation").checked = true;
            if (fc.goalBank && el("fcGoalBank")) el("fcGoalBank").value = fc.goalBank;
            if (fc.goalTarget && el("fcGoalTarget")) el("fcGoalTarget").value = fc.goalTarget;
            if (fc.goalYears && el("fcGoalYears")) el("fcGoalYears").value = fc.goalYears;
            if (fc.goalRate && el("fcGoalRate")) el("fcGoalRate").value = fc.goalRate;
            if (el("fcShowAll")) el("fcShowAll").checked = !!fc.fcShowAll;
          })();
el("fcInvest").addEventListener("input", (e) => {
            state.forecast.investments = num(e.target.value);
            renderForecast();
            saveState();
          });
el("fcMonthly").addEventListener("input", (e) => {
            state.forecast.monthlyInvest = num(e.target.value);
            renderForecast();
            saveState();
          });
el("fcRate").addEventListener("input", (e) => {
            state.forecast.annualRate = parseFloat(e.target.value) || 0;
            renderForecast();
            saveState();
          });
el("fcSlider").addEventListener("input", () => renderForecast());
if (fcStepUpEl) fcStepUpEl.addEventListener("input", (e) => {
            state.forecast.stepUp = parseFloat(e.target.value) || 0;
            renderForecast(); saveState();
          });
if (fcInflEl) fcInflEl.addEventListener("change", (e) => {
            state.forecast.useInflation = e.target.checked;
            renderForecast(); saveState();
          });
document.querySelectorAll(".fc-mode-btn").forEach(btn => {
            btn.addEventListener("click", () => {
              const mode = btn.dataset.mode;
              if (!mode) return;
              state.forecast.mode = mode;
              document.querySelectorAll(".fc-mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
              renderForecast(); saveState();
            });
          });
document.querySelectorAll(".fc-scenario-btn").forEach(btn => {
            btn.addEventListener("click", () => {
              const sc = btn.dataset.sc;
              if (!sc) return;
              state.forecast.fcScenario = sc;
              document.querySelectorAll(".fc-scenario-btn").forEach(b => b.classList.toggle("active", b.dataset.sc === sc));
              renderForecast(); saveState();
            });
          });
if (fcShowAllEl) fcShowAllEl.addEventListener("change", (e) => {
            state.forecast.fcShowAll = e.target.checked;
            renderForecast(); saveState();
          });
["fcGoalBank","fcGoalTarget","fcGoalYears","fcGoalRate"].forEach(id => {
            const e = el(id); if (!e) return;
            e.addEventListener("input", () => {
              state.forecast.goalBank   = num(el("fcGoalBank")?.value);
              state.forecast.goalTarget = num(el("fcGoalTarget")?.value);
              state.forecast.goalYears  = parseFloat(el("fcGoalYears")?.value) || 10;
              state.forecast.goalRate   = parseFloat(el("fcGoalRate")?.value)  || 12;
              renderForecast(); saveState();
            });
          });
document.body.classList.add("privacy-mode");
el("privacyBtn").addEventListener("click", () => {
            setPrivacyMode(!privacyMode);
            document.body.classList.toggle("privacy-mode", privacyMode);
          });
if (_upcomingHead) _upcomingHead.addEventListener("click", () => toggleColl("upcoming"));
el("addLiqBtn").addEventListener("click", () => {
            const order = state.liquidOrder || [];
            let n = order.length + 1;
            while (order.includes("liq" + n)) n++;
            const newId = "liq" + n;
            const defaultName = "Liquid Fund " + n;
            state.liquid[newId] = { name: defaultName, label: defaultName, paid: 0, value: 0, reserve: 0, target: 0 };
            state.liquidOrder = [...order, newId];
            syncFundArrays();
            rebuildFundCollapsibles();
            render();
            setTimeout(() => toggleColl(newId), 50);
          });
el("addEqBtn").addEventListener("click", () => {
            const order = state.equityOrder || [];
            let n = order.length + 1;
            while (order.includes("eq" + n)) n++;
            const newId = "eq" + n;
            const defaultName = "Equity Fund " + n;
            state.equity[newId] = { name: defaultName, label: defaultName, paid: 0, shown: 0, target: 0, sipAmt: 0, sipDate: 5, sipPaidAmounts: {} };
            state.equityOrder = [...order, newId];
            syncFundArrays();
            rebuildFundCollapsibles();
            render();
            setTimeout(() => {
              toggleColl(newId);
              setTimeout(() => {
                const catSel = el("cat-" + newId);
                if (catSel) {
                  catSel.classList.add("cat-required");
                  catSel.focus();
                  catSel.addEventListener("change", () => catSel.classList.remove("cat-required"), { once: true });
                }
              }, 150);
            }, 50);
          });
initFirebase();
syncFundArrays();
rebuildFundCollapsibles();
buildNwGrid();
el("nwSnapshotBtn").addEventListener("click", takeSnapshot);
el("nwSnapCancelBtn").addEventListener("click", () => {
            if (nwLiveSaved) {
              NW_FIELDS.forEach(f => { state.networth[f.id] = nwLiveSaved[f.id] || 0; });
              setNwLiveSaved(null);
            }
            setNwEditingKey(null);
            buildNwGrid();
            renderNetWorth();
            const msg = el("nwSnapMsg"); if (msg) msg.textContent = "";
          });
el("nwSnapEditBtn").addEventListener("click", () => {
            const key = snapshotKey();
            const snap = state.networth.snapshots && state.networth.snapshots[key];
            if (!snap) return;
            setNwLiveSaved({});
            NW_FIELDS.forEach(f => { nwLiveSaved[f.id] = state.networth[f.id] || 0; });
            NW_FIELDS.forEach(f => { state.networth[f.id] = snap[f.id] || 0; });
            setNwEditingKey(key);
            buildNwGrid();
            renderNetWorth();
            const msg = el("nwSnapMsg");
            if (msg) msg.textContent = "Editing " + fmtMonth(key) + " — adjust values and click Update";
          });
el("nwSnapDeleteBtn").addEventListener("click", () => {
            const key = snapshotKey();
            UI.confirm("Delete snapshot for " + fmtMonth(key) + "?", "Delete snapshot", "Delete", () => {
              if (state.networth.snapshots) delete state.networth.snapshots[key];
              saveState();
              renderNetWorth();
              renderNwHistory();
              renderNwLineChart();
              renderNwProjection();
            });
          });
el("nwEnterToggle").addEventListener("click", () => {
            const body    = el("nwEnterBody");
            const toggle  = el("nwEnterToggle");
            const chevron = el("nwEnterChevron");
            const isOpen  = body.style.display !== "none";
            body.style.display       = isOpen ? "none" : "";
            chevron.style.transform  = isOpen ? "rotate(-90deg)" : "";
            toggle.classList.toggle("open", !isOpen);
          });
el("holdingsToggle").addEventListener("click", () => {
            const widget = el("holdingsWidget");
            const body   = el("holdingsBody");
            const isOpen = widget.classList.contains("open");
            widget.classList.toggle("open", !isOpen);
            body.hidden = isOpen;
            el("holdingsToggle").setAttribute("aria-expanded", String(!isOpen));
          });
renderNwHistory();
renderNwLineChart();
renderNwProjection();
applyTxnTotals();
render();
if (fbEnabled && !_hasLocalData) {
            LIQ_FUNDS.forEach(f => { el("liq-wrap-" + f.id).innerHTML = UI.skeleton(1); });
            EQ_FUNDS.forEach(f => { el("eq-wrap-" + f.id).innerHTML = UI.skeleton(1); });
          }
document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && editMode) {
              saveState();
              setEditMode(false);
              UI.toast("success", "Changes saved", 2200);
            } else if (e.key === "Escape") {
              hideThemeMatrix();
            }
          });
document.querySelectorAll(".pg-head h1").forEach((h1) => {
            h1.addEventListener("click", (e) => {
              e.stopPropagation();
              if (themeMatrixOpen) {
                hideThemeMatrix();
              } else {
                showThemeMatrix(h1);
              }
            });
          });
document.addEventListener("click", (e) => {
            if (!themeMatrixOpen) return;
            const matrix = document.getElementById("themeMatrix");
            if (matrix && !matrix.contains(e.target)) hideThemeMatrix();
          });
buildThemeMatrix();
loadSavedAccent();
