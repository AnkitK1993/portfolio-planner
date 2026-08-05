import "./styles/base.css";
import "./styles/themes.css";
import "./styles/components.css";

import { EQ_FUNDS, LIQ_FUNDS, editMode, privacyMode, saveState, setEditMode, setPrivacyMode, state, syncFundArrays, toggleEditMode, toggleRtnMode } from "./core/state.js";
import { registerCardOrder } from "./core/cardOrder.js";
import { UI, closeNavDropdowns, collapseTxpCard, navigateTo, openNavDropdown } from "./core/ui.js";
import { setRenderTrigger, setTabActivateHandler } from "./core/appEvents.js";
import { addEquityFund, addLiquidFund, setForecastField } from "./store/actions.js";
import { _hasLocalData, authUser, fbAuthReady, fbEnabled, flushCloudSave, handleSignInResult, initFirebase, loadBackupList, loadSyncHistory, resetBackupPanel, saveManualBackup } from "./infra/firebase.js";
import { _upcomingHead } from "./features/portfolio/upcoming.js";
import { animateNumber } from "./core/animate.js";
import { applyTxnTotals, closeCurValModal, closeTxnModal, exportTxnsCSV, importTxnsCSV, openCurValModal, openTxnModal, renderReturns, renderTxns, saveCurVal, saveTxn, setTxnType, txnFilter } from "./features/transactions/index.js";
import { buildNwGrid, renderAssetTrends, renderNwCompositionChart, renderNwHistory, renderNwLineChart, renderNwProjection, renderSnapshotsList, takeSnapshot } from "./features/networth/index.js";
import { hideThemeMatrix, loadSavedAccent, showThemeMatrix, themeMatrixOpen } from "./features/admin/themes.js";
import { calDayDate, calMonth, calView, calWeekOffset, calYear, closeCalDayModal, closeCalNoteModal, openCalNoteModal, renderCalendar, saveCalNote, setCalMonth, setCalView, setCalWeekOffset, setCalYear } from "./features/portfolio/calendar.js";
import { createCollapsible } from "./core/collapsible.js";
import { el } from "./core/dom.js";
import { exportData, importData } from "./features/admin/data.js";
import { fcInflEl, fcShowAllEl, fcStepUpEl, renderForecast } from "./features/forecast/index.js";
import { num } from "./core/format.js";
import { openManageSips, saveManageSips } from "./features/portfolio/sips.js";
import { openFundCollapsible, rebuildFundCollapsibles } from "./features/portfolio/funds.js";
import { render, scheduleRender } from "./features/portfolio/render.js";

el("buildVersion").textContent = "v" + __BUILD_VERSION__;

// core/ui.js's navigateTo() needs to trigger a re-render and, for two
// tabs, refresh the transactions list — but core/ isn't allowed to import
// features/ directly (that's what caused most of the dependency cycle
// this session's architecture audit found). Registering the real handlers
// here, at the composition root, is what breaks that edge.
setRenderTrigger(scheduleRender);
setTabActivateHandler(tabId => {
            if (tabId === "transactions") {
              el("txnTabInvest").classList.add("active");
              el("txnTabReturns").classList.remove("active");
              el("txnList").style.display = "";
              el("txnFilters").style.display = "";
              el("returnsList").style.display = "none";
              renderTxns();
            }
          });

el("homeBtn").addEventListener("click", () => navigateTo("portfolio"));
el("editToggleBtn").addEventListener("click", () => { closeNavDropdowns(); toggleEditMode(); });
el("summaryBtn").addEventListener("click", () => {
            if (!authUser) { UI.toast("err", "Unauthorized — please sign in to access this section", 4000); return; }
            navigateTo("summary");
          });
el("networthBtn").addEventListener("click", () => {
            if (!authUser) { UI.toast("err", "Unauthorized — please sign in to access this section", 4000); return; }
            navigateTo("networth");
          });
el("planningBtn").addEventListener("click", () => {
            if (!authUser) { UI.toast("err", "Unauthorized — please sign in to access this section", 4000); return; }
            navigateTo("forecast");
          });
el("adminBtn").addEventListener("click", e => { e.stopPropagation(); openNavDropdown("adminDropdown", el("adminBtn")); });
document.addEventListener("click", e => {
            if (!e.target.closest("#adminDropdown")) closeNavDropdowns();
          });
el("txnsBtn").addEventListener("click", () => { navigateTo("transactions"); });
const dataModalCtl = UI.registerOverlay(el("dataModal"), { onClose: resetBackupPanel });
el("ddDataBtn").addEventListener("click", () => { closeNavDropdowns(); dataModalCtl.open(); });
el("ddPrintBtn").addEventListener("click", () => { closeNavDropdowns(); window.print(); });
el("txnExportBtn").addEventListener("click", e => { e.stopPropagation(); exportTxnsCSV(); });
el("txnImportBtn").addEventListener("click", e => { e.stopPropagation(); el("txnImportFile").click(); });
el("txnImportFile").addEventListener("change", e => {
            importTxnsCSV(e.target.files[0]);
            e.target.value = ""; // reset so the same file can be re-imported
          });
["txp-history", "txp-curval", "txp-sip", "txp-entervalues", "txp-snapshot"].forEach(id => {
            const head = el(id + "-head");
            if (!head) return;
            head.addEventListener("click", () => {
              const card = el(id);
              const willOpen = !card.classList.contains("open");
              card.classList.toggle("open");
              if (willOpen) {
                if (id === "txp-curval") openCurValModal();
                if (id === "txp-sip") openManageSips();
              }
            });
          });
// Add/Edit Transaction is a floating modal rather than an inline
// expanding card — both the "+" entry point here and a History row's
// "Edit" button (openTxnModal(id), features/transactions/index.js) open
// the same #txnModal, since they share the same form markup.
UI.registerOverlay(el("txnModal"));
el("txnAddBtn").addEventListener("click", () => openTxnModal());
el("txnModalClose").addEventListener("click", closeTxnModal);
el("dataModalClose").addEventListener("click", () => dataModalCtl.close());
el("dataModalCancelBtn").addEventListener("click", () => dataModalCtl.close());
el("dataExportBtn").addEventListener("click", exportData);
el("dataImportBtn").addEventListener("click", () => el("dataImportFile").click());
el("dataImportFile").addEventListener("change", importData);
el("backupNowBtn").addEventListener("click", saveManualBackup);
el("backupBrowseBtn").addEventListener("click", loadBackupList);
el("syncHistBrowseBtn").addEventListener("click", loadSyncHistory);
el("curValCancelBtn").addEventListener("click", closeCurValModal);
el("curValSaveBtn").addEventListener("click", saveCurVal);
el("txnTabInvest").addEventListener("click", () => {
            el("txnTabInvest").classList.add("active");
            el("txnTabReturns").classList.remove("active");
            el("txnList").style.display = "";
            el("txnFilters").style.display = "";
            el("returnsList").style.display = "none";
            renderTxns();
          });
el("txnTabReturns").addEventListener("click", () => {
            el("txnTabReturns").classList.add("active");
            el("txnTabInvest").classList.remove("active");
            el("txnList").style.display = "none";
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
el("calDayClose").addEventListener("click", closeCalDayModal);
el("calDayCloseBtn").addEventListener("click", closeCalDayModal);
el("calDayAddBtn").addEventListener("click", () => openCalNoteModal(calDayDate, null));
el("calNoteClose").addEventListener("click", closeCalNoteModal);
el("calNoteCancelBtn").addEventListener("click", closeCalNoteModal);
el("calNoteSaveBtn").addEventListener("click", saveCalNote);
el("sipModalCancelBtn").addEventListener("click", () => collapseTxpCard("txp-sip"));
el("sipModalSaveBtn").addEventListener("click", saveManageSips);
el("ddAuthBtn").addEventListener("click", async () => {
            if (!fbAuthReady) {
              UI.toast("err", "Firebase still connecting — try again in a moment", 3000);
              return;
            }
            closeNavDropdowns();
            await firebase.auth().signOut()
              .catch(e => UI.toast("err", "Sign-out failed: " + e.message, 4000));
          });
el("ddLoginForm").addEventListener("submit", async e => {
            e.preventDefault();
            if (!fbAuthReady) {
              UI.toast("err", "Firebase still connecting — try again in a moment", 3000);
              return;
            }
            const email = el("ddLoginEmail").value.trim();
            const password = el("ddLoginPassword").value;
            if (!email || !password) return;
            const submitBtn = el("ddLoginSubmit");
            submitBtn.disabled = true;
            try {
              const result = await firebase.auth().signInWithEmailAndPassword(email, password);
              handleSignInResult(result);
              el("ddLoginForm").reset();
            } catch (err) {
              UI.toast("err", err.message || "Sign-in failed", 5000);
            } finally {
              submitBtn.disabled = false;
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
            setForecastField("investments", num(e.target.value));
            renderForecast();
            saveState();
          });
el("fcMonthly").addEventListener("input", (e) => {
            setForecastField("monthlyInvest", num(e.target.value));
            renderForecast();
            saveState();
          });
el("fcRate").addEventListener("input", (e) => {
            setForecastField("annualRate", parseFloat(e.target.value) || 0);
            renderForecast();
            saveState();
          });
el("fcSlider").addEventListener("input", () => renderForecast());
if (fcStepUpEl) fcStepUpEl.addEventListener("input", (e) => {
            setForecastField("stepUp", parseFloat(e.target.value) || 0);
            renderForecast(); saveState();
          });
if (fcInflEl) fcInflEl.addEventListener("change", (e) => {
            setForecastField("useInflation", e.target.checked);
            renderForecast(); saveState();
          });
document.querySelectorAll(".fc-mode-btn").forEach(btn => {
            btn.addEventListener("click", () => {
              const mode = btn.dataset.mode;
              if (!mode) return;
              setForecastField("mode", mode);
              document.querySelectorAll(".fc-mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
              renderForecast(); saveState();
            });
          });
document.querySelectorAll(".fc-scenario-btn").forEach(btn => {
            btn.addEventListener("click", () => {
              const sc = btn.dataset.sc;
              if (!sc) return;
              setForecastField("fcScenario", sc);
              document.querySelectorAll(".fc-scenario-btn").forEach(b => b.classList.toggle("active", b.dataset.sc === sc));
              renderForecast(); saveState();
            });
          });
if (fcShowAllEl) fcShowAllEl.addEventListener("change", (e) => {
            setForecastField("fcShowAll", e.target.checked);
            renderForecast(); saveState();
          });
["fcGoalBank","fcGoalTarget","fcGoalYears","fcGoalRate"].forEach(id => {
            const e = el(id); if (!e) return;
            e.addEventListener("input", () => {
              setForecastField("goalBank",   num(el("fcGoalBank")?.value));
              setForecastField("goalTarget", num(el("fcGoalTarget")?.value));
              setForecastField("goalYears",  parseFloat(el("fcGoalYears")?.value) || 10);
              setForecastField("goalRate",   parseFloat(el("fcGoalRate")?.value)  || 12);
              renderForecast(); saveState();
            });
          });
document.body.classList.add("privacy-mode");
el("privacyBtn").addEventListener("click", () => {
            setPrivacyMode(!privacyMode);
            document.body.classList.toggle("privacy-mode", privacyMode);
          });
if (_upcomingHead) createCollapsible({ header: _upcomingHead, body: el("coll-body-upcoming") });
el("addLiqBtn").addEventListener("click", () => {
            const order = state.liquidOrder || [];
            let n = order.length + 1;
            while (order.includes("liq" + n)) n++;
            const newId = "liq" + n;
            const defaultName = "Liquid Fund " + n;
            addLiquidFund(newId, { name: defaultName, label: defaultName, paid: 0, value: 0, reserve: 0, target: 0 });
            syncFundArrays();
            rebuildFundCollapsibles();
            render();
            setTimeout(() => openFundCollapsible(newId), 50);
          });
el("addEqBtn").addEventListener("click", () => {
            const order = state.equityOrder || [];
            let n = order.length + 1;
            while (order.includes("eq" + n)) n++;
            const newId = "eq" + n;
            const defaultName = "Equity Fund " + n;
            addEquityFund(newId, { name: defaultName, label: defaultName, paid: 0, shown: 0, target: 0, sipAmt: 0, sipDate: 5, sipPaidAmounts: {} });
            syncFundArrays();
            rebuildFundCollapsibles();
            render();
            setTimeout(() => {
              openFundCollapsible(newId);
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
/* Debounced cloud saves can be stranded if the tab closes before the
   timer fires — flush immediately on any hide/unload transition. */
document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") flushCloudSave();
          });
window.addEventListener("pagehide", () => flushCloudSave());
syncFundArrays();
rebuildFundCollapsibles();
buildNwGrid();
el("nwSnapshotBtn").addEventListener("click", takeSnapshot);
// Edit/Delete for individual snapshots now live inside the Snapshots
// list itself (renderSnapshotsList()/editSnapshot(), features/networth/
// index.js) and Monthly History's own list — both cover every saved
// month, not just the current one, so the old current-month-only
// #nwSnapExisting buttons are gone. editSnapshot() opens a self-contained
// popup with its own Save/Cancel rather than reusing Update Assets, so
// editing a past snapshot never touches live/current networth state.
// Groups a set of createCollapsible()-driven cards behind one icon
// button that expands/collapses all of them together — used for both
// the Net Worth and Summary tab card stacks. The button's aria-label/
// title always reflects the action the NEXT click performs, refreshed
// whenever any card (individually or via the button itself) changes
// open state.
function makeToggleAllGroup(btnId) {
            const btn = el(btnId);
            const items = [];
            function refresh() {
              if (!btn || !items.length) return;
              const allOpen = items.every(c => c.isOpen());
              btn.classList.toggle("all-open", allOpen);
              const label = allOpen ? "Collapse all cards" : "Expand all cards";
              btn.title = label;
              btn.setAttribute("aria-label", label);
            }
            btn?.addEventListener("click", () => {
              const allOpen = items.every(c => c.isOpen());
              items.forEach(c => (allOpen ? c.close() : c.open()));
              refresh();
            });
            return {
              add(headerId, bodyId, previewId) {
                const c = createCollapsible({
                  header: el(headerId), body: el(bodyId), onToggle: refresh,
                  collapsedSummary: previewId ? el(previewId) : null,
                });
                items.push(c);
                return c;
              },
              refresh,
            };
          }

// Update Assets (formerly "Enter Values") moved to the Transactions tab
// (see the txp-card wiring above) and is no longer part of this group.
const nwToggleAll = makeToggleAllGroup("nwToggleAllBtn");
[
            ["nwBreakdownToggle", "nwBreakdownBody", "nwBreakdownPreview"],
            ["nwAssetTrendsToggle", "nwAssetTrendsBody", null],
            ["nwHistToggle", "nwHistBody", "nwHistPreview"],
            ["nwChartToggle", "nwChartBody", "nwChartPreview"],
            ["nwCompChartToggle", "nwCompChartBody", null],
            ["nwProjToggle", "nwProjBody", "nwProjPreview"],
          ].forEach(([headerId, bodyId, previewId]) => nwToggleAll.add(headerId, bodyId, previewId));
nwToggleAll.refresh();
createCollapsible({ header: el("holdingsToggle"), body: el("holdingsBody") });
// Every collapsible card on the Analytics tab after Portfolio Health Score
// (which stays plain/always-expanded) is grouped behind #sumToggleAllBtn
// the same way the Net Worth tab's cards are. Streak/Fund Performance/Tax
// Estimate get their own previews populated by their render functions
// (see summary/index.js).
const sumToggleAll = makeToggleAllGroup("sumToggleAllBtn");
[
            ["sumXirrToggle", "sumXirrCollBody", null],
            ["sumAllocToggle", "sumAllocCollBody", null],
            ["sumCompToggle", "sumCompCollBody", null],
            ["sumIdealToggle", "sumIdealCollBody", null],
            ["sumRebalActionsToggle", "sumRebalActionsCollBody", "sumRebalActionsPreview"],
            ["sumStreakToggle", "sumStreakCollBody", "sumStreakPreview"],
            ["sumFundToggle", "sumFundCollBody", "sumFundPreview"],
            ["sumTaxToggle", "sumTaxCollBody", "sumTaxPreview"],
            ["sumHeatmapToggle", "sumHeatmapCollBody", null],
            ["calToggle", "calCollBody", null],
          ].forEach(([headerId, bodyId, previewId]) => sumToggleAll.add(headerId, bodyId, previewId));
sumToggleAll.refresh();
// Planning tab's own expand-all group — Expenses/Financial Goals (moved
// here from the now-removed standalone Budget tab; Expenses keeps its
// existing Total-This-Month collapsed preview), Projections (the
// forecast tool, previously the only always-open content on this tab),
// and Rebalance (moved here from Budget earlier).
const planningToggleAll = makeToggleAllGroup("planningToggleAllBtn");
[
            ["expCardToggle", "expCardBody", "expCollapsedTotal"],
            ["sumExpTrendsToggle", "sumExpTrendsCollBody", "sumExpTrendsPreview"],
            ["sumFireToggle", "sumFireCollBody", "sumFirePreview"],
            ["fcCardToggle", "fcCardCollBody", null],
            ["planningRebalanceToggle", "planningRebalanceCollBody", null],
            ["sumLoansToggle", "sumLoansCollBody", "sumLoansPreview"],
            ["investNewMoneyToggle", "investNewMoneyCollBody", null],
          ].forEach(([headerId, bodyId, previewId]) => planningToggleAll.add(headerId, bodyId, previewId));
planningToggleAll.refresh();
// Monthly Investment / By Fund (Transactions tab) aren't part of a
// toggle-all group — there's no "expand all" button on that tab — but
// still need their own collapsedSummary wiring for their previews.
createCollapsible({ header: el("txnBarToggle"), body: el("txnBarCollBody"), collapsedSummary: el("txnBarPreview") });
createCollapsible({ header: el("txnDonutToggle"), body: el("txnDonutCollBody") });
// Card reordering (Edit mode only) — up/down arrows, not drag-and-drop,
// so it needs no extra library and works the same on touch and mouse.
// Health Score stays pinned first (excluded), same as it's excluded
// from the collapsible/expand-all group above.
registerCardOrder("summary", [
            "sumXirrCard", "sumAllocCard", "sumCompositionCard", "sumIdealCard", "sumRebalActionsCard",
            "sumStreakCard", "sumFundCard", "sumTaxCard", "sumHeatmapCard", "sumCalCard",
          ]);
registerCardOrder("planning", ["sumExpensesCard", "sumExpTrendsCard", "sumFireCard", "fcCard", "planningRebalanceCard", "sumLoansCard", "investNewMoneyCard"]);
registerCardOrder("transactions", ["txp-history", "txp-curval", "txp-sip", "txp-entervalues", "txp-snapshot", "txnCharts"]);
registerCardOrder("networth", ["nwBreakdownCard", "nwAssetTrendsCard", "nwHistCard", "nwChartCard", "nwCompChartCard", "nwProjCard"]);
// Returns badges (Total bar + Liquid/Equity division rows) toggle between
// absolute return% and XIRR on click — all badges switch together since
// they're one shared display preference (see rtnMode in core/state.js).
el("holdingsRtn").addEventListener("click", e => { e.stopPropagation(); toggleRtnMode(); });
el("liqDivRtn").addEventListener("click", e => { e.stopPropagation(); toggleRtnMode(); });
el("eqDivRtn").addEventListener("click", e => { e.stopPropagation(); toggleRtnMode(); });
renderNwHistory();
renderSnapshotsList();
renderNwLineChart();
renderNwCompositionChart();
renderNwProjection();
renderAssetTrends();
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
loadSavedAccent();
