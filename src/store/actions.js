// Named, testable state mutations — the first step toward `state`
// (core/state.js) being something only this module reaches into
// directly, instead of a shared mutable object that sips.js, calendar.js,
// rebalance.js, networth/index.js, and main.js each poke at their own way.
//
// Deliberately does NOT call saveState() or trigger any render itself —
// callers keep doing that exactly where they already do. Migrating a call
// site to use these functions changes nothing about *when* data is
// persisted or the UI re-renders, only how the mutation itself is
// expressed and where it lives. (See the architecture-audit notes from
// this session for the exact call sites each of these replaces.)

import { EQ_FUNDS, LIQ_FUNDS, othersOfSnap, state } from "../core/state.js";

function fundBucket(fundId) {
            return LIQ_FUNDS.some(f => f.id === fundId) ? state.liquid : state.equity;
          }

function fundAfterExpenseValue(fundId) {
            const isLiq = LIQ_FUNDS.some(f => f.id === fundId);
            const s = fundBucket(fundId)[fundId];
            return isLiq ? (s?.value || 0) : (s?.shown || 0);
          }

// ── SIPs — replaces sips.js's saveManageSips() alias-mutation ──
export function setFundSip(fundId, sipAmt, sipDate) {
            const s = fundBucket(fundId)[fundId];
            if (!s) return;
            s.sipAmt = sipAmt;
            s.sipDate = sipDate;
          }

// ── Calendar notes — replaces calendar.js's direct state.calendarNotes
// reach-through in saveCalNote()/removeCalNote() ──
export function addCalendarNote({ date, funds, note }) {
            if (!state.calendarNotes) state.calendarNotes = [];
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
            state.calendarNotes.push({ id, date, funds, note });
            return id;
          }

export function updateCalendarNote(id, { date, funds, note }) {
            const n = (state.calendarNotes || []).find(x => x.id === id);
            if (!n) return false;
            n.date = date;
            n.funds = funds;
            n.note = note;
            delete n.fundId;
            delete n.amount;
            return true;
          }

export function deleteCalendarNote(id) {
            state.calendarNotes = (state.calendarNotes || []).filter(n => n.id !== id);
          }

// Target = planned/scheduled amount + whatever's already invested — the
// same formula used both right after scheduling a transaction and when
// recomputing a target after something else changed.
export function setFundTarget(fundId, plannedAmount) {
            const s = fundBucket(fundId)[fundId];
            if (!s) return;
            s.target = plannedAmount + fundAfterExpenseValue(fundId);
          }

export function recalcFundTarget(fundId) {
            const today = new Date().toISOString().split("T")[0];
            const s = fundBucket(fundId)[fundId];
            if (!s) return;

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
              if (entry) { setFundTarget(fundId, entry.amount); return; }
            }

            const sipAmt = s.sipAmt || 0;
            if (sipAmt > 0) setFundTarget(fundId, sipAmt);
            // Nothing left — leave target as-is (matches the original
            // recalcFundTarget()'s fall-through behavior exactly).
          }

// ── Rebalance table — replaces rebalance.js's 5 inline handlers ──
export function setRebalanceSectionName(sectionIdx, name) {
            state.rebalance.sections[sectionIdx].name = name;
          }

export function setRebalanceRowName(sectionIdx, rowIdx, name) {
            state.rebalance.sections[sectionIdx].rows[rowIdx].name = name;
          }

export function setRebalanceRowValue(sectionIdx, rowIdx, col, value) {
            state.rebalance.sections[sectionIdx].rows[rowIdx][col] = value;
          }

export function deleteRebalanceRow(sectionIdx, rowIdx) {
            state.rebalance.sections[sectionIdx].rows.splice(rowIdx, 1);
          }

export function deleteRebalanceSection(sectionIdx) {
            state.rebalance.sections.splice(sectionIdx, 1);
          }

// Caller builds the row/section object (via rebalance.js's existing
// rebUid()/rebSuid()) — this action just owns where it gets inserted.
export function addRebalanceRow(sectionIdx, row) {
            state.rebalance.sections[sectionIdx].rows.push(row);
          }

export function addRebalanceSection(section) {
            state.rebalance.sections.push(section);
          }

// ── Ideal allocation weights ──
export function setIdealWeight(category, weight) {
            if (!state.idealWeights) state.idealWeights = {};
            state.idealWeights[category] = weight;
          }

// ── Net worth — replaces direct state.networth[f.id] = ... reach-throughs
// in networth/index.js's buildNwGrid() and main.js's snapshot-edit/cancel
// handlers ──
export function setNetworthField(fieldId, value) {
            state.networth[fieldId] = value;
          }

export function saveSnapshot(key, snap) {
            if (!state.networth.snapshots) state.networth.snapshots = {};
            state.networth.snapshots[key] = snap;
          }

export function deleteSnapshot(key) {
            if (state.networth.snapshots) delete state.networth.snapshots[key];
          }

// Recomputes a snapshot's MF Value (and the total that depends on it) in
// place — replaces renderNwHistory()'s self-healing block, which corrects
// any snapshot whose saved MF figure has drifted from what the
// transaction history as-of that month actually says.
export function healSnapshotMf(key, correctMf) {
            const snap = state.networth.snapshots?.[key];
            if (!snap) return;
            snap.mf = correctMf;
            snap.total = correctMf + (snap.mfProfit || 0) + othersOfSnap(snap);
          }

// ── Forecast — replaces main.js's 11 direct state.forecast.xxx = ... sites ──
export function setForecastField(field, value) {
            state.forecast[field] = value;
          }

// ── Adding a fund — replaces main.js's addLiqBtn/addEqBtn handlers,
// which built the fund object and pushed to the order array inline ──
export function addLiquidFund(id, fund) {
            state.liquid[id] = fund;
            state.liquidOrder = [...(state.liquidOrder || []), id];
          }

export function addEquityFund(id, fund) {
            state.equity[id] = fund;
            state.equityOrder = [...(state.equityOrder || []), id];
          }
