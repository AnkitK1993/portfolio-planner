import { BASE_EQ_DEFAULTS, BASE_LIQ_DEFAULTS, NW_FIELDS, OTHER_FIELDS, STORE_KEY } from "./constants.js";
import { UI, updateCollNameReadonly } from "./ui.js";
import { el } from "./dom.js";
import { fbEnabled, scheduleCloudSave } from "../infra/firebase.js";
import { render } from "../features/portfolio/render.js";

export let LIQ_FUNDS = [];

export let EQ_FUNDS = [];

export function syncFundArrays() {
            LIQ_FUNDS = (state.liquidOrder || Object.keys(BASE_LIQ_DEFAULTS))
              .filter(id => !state.liquid[id]?.archived)
              .map(id => ({ id, defaultName: BASE_LIQ_DEFAULTS[id] || state.liquid[id]?.name || "Liquid Fund" }));
            EQ_FUNDS = (state.equityOrder || Object.keys(BASE_EQ_DEFAULTS))
              .filter(id => !state.equity[id]?.archived)
              .map(id => ({ id, defaultName: BASE_EQ_DEFAULTS[id] || state.equity[id]?.name || "Equity Fund" }));
          }

export const othersOfSnap = (s) => OTHER_FIELDS.reduce((sum, f) => sum + (s[f.id] || 0), 0);

export const normalizeSnap = (key, v) => {
            const s = { key, ...v };
            s.total = (s.mf || 0) + (s.mfProfit || 0) + othersOfSnap(s);
            return s;
          };

export function defaultState() {
            return {
              liquid: {
                liq1: { name: "Liquid Fund 1", label: "Liquid Fund 1", paid: 0, value: 0, reserve: 0, target: 0 },
                liq2: { name: "Liquid Fund 2", label: "Liquid Fund 2", paid: 0, value: 0, reserve: 0, target: 0 },
              },
              equity: {
                eq1: {
                  name: "Nifty 50 Index Fund",
                  label: "Nifty 50 Index Fund",
                  paid: 0,
                  shown: 0,
                  target: 0,
                  sipAmt: 0,
                  sipDate: 5,
                  sipPaidAmounts: {},
                },
                eq2: {
                  name: "Flexi Cap Fund",
                  label: "Flexi Cap Fund",
                  paid: 0,
                  shown: 0,
                  target: 0,
                  sipAmt: 0,
                  sipDate: 5,
                  sipPaidAmounts: {},
                },
                eq3: {
                  name: "Mid Cap Fund",
                  label: "Mid Cap Fund",
                  paid: 0,
                  shown: 0,
                  target: 0,
                  sipAmt: 0,
                  sipDate: 5,
                  sipPaidAmounts: {},
                },
              },
              liquidOrder: ['liq1', 'liq2'],
              equityOrder: ['eq1', 'eq2', 'eq3'],
              networth: {
                ...Object.fromEntries(NW_FIELDS.map((f) => [f.id, 0])),
                snapshots: {},
              },
              forecast: { investments: 0, monthlyInvest: 0, annualRate: 12, stepUp: 0, inflationRate: 6, mode: "project", goalBank: 0, goalTarget: 0, goalYears: 10, goalRate: 12, fcScenario: "base", fcShowAll: false },
              idealWeights: { "Large Cap": 45, "Flexi Cap": 33, "Mid Cap": 22 },
              transactions: [],
              returnsLog: [],
              calendarNotes: [],
              rebalance: { sections: defaultRebSections() },
              _meta: { v: 0, savedAt: null, syncedAt: null },
            };
          }

export function defaultRebSections() {
            const s = (id, name, rows) => ({ id, name, rows });
            const r = (id, name) => ({ id, name, mm: 0, real: 0 });
            return [
              s("s_cash", "Cash", [r("r_cash_snehal","Snehal"), r("r_cash_ankit","Ankit"), r("r_cash_vault","Vault")]),
              s("s_bank", "Bank", [r("r_bank_idfcj","IDFC Joint"), r("r_bank_ankidfc","Ankit IDFC"), r("r_bank_snidfc","Snehal IDFC"), r("r_bank_snhdfc","Snehal HDFC"), r("r_bank_snhsbc","Snehal HSBC"), r("r_bank_ankaxis","Ankit AXIS"), r("r_bank_ankpsb","Ankit PSB")]),
              s("s_mf", "Mutual Funds", [r("r_mf_total","Total")]),
              s("s_bonds", "Bonds", [r("r_bonds_total","Total")]),
              s("s_ppf", "PPF", [r("r_ppf_total","Total")]),
              s("s_cards", "Cards", [r("r_cards_amazon","AMAZON"), r("r_cards_hsbc","HSBC"), r("r_cards_sbi","SBI")]),
            ];
          }

export function loadState() {
            const def = defaultState();
            try {
              const raw = localStorage.getItem(STORE_KEY);
              if (!raw) return def;
              const s = JSON.parse(raw);
              const liqOrder = s.liquidOrder || ['liq1', 'liq2'];
              const eqOrder = s.equityOrder || ['eq1', 'eq2', 'eq3'];
              const liqBase = { name: '', label: '', paid: 0, value: 0, reserve: 0, target: 0 };
              const eqBase = { name: '', label: '', paid: 0, shown: 0, target: 0, sipAmt: 0, sipDate: 5, sipPaidAmounts: {} };
              return {
                liquid: Object.fromEntries(liqOrder.map(id => [id, { ...liqBase, ...(s.liquid?.[id] || {}) }])),
                equity: Object.fromEntries(eqOrder.map(id => [id, { ...eqBase, ...(s.equity?.[id] || {}) }])),
                liquidOrder: liqOrder,
                equityOrder: eqOrder,
                networth: {
                  ...Object.fromEntries(NW_FIELDS.map((f) => [f.id, s.networth?.[f.id] ?? 0])),
                  snapshots: { ...(s.networth?.snapshots || {}) },
                },
                forecast: { ...def.forecast, ...(s.forecast || {}) },
                idealWeights: { ...def.idealWeights, ...(s.idealWeights || {}) },
                transactions: Array.isArray(s.transactions) ? s.transactions : [],
                returnsLog: Array.isArray(s.returnsLog) ? s.returnsLog : [],
                calendarNotes: Array.isArray(s.calendarNotes) ? s.calendarNotes : [],
                rebalance: { sections: Array.isArray(s.rebalance?.sections) ? s.rebalance.sections : defaultRebSections() },
                _meta: { ...def._meta, ...(s._meta || {}) },
              };
            } catch {
              return def;
            }
          }

export let state = loadState();

export function setState(v) { state = v; }

export let editMode = false;

export function setEditMode(on) {
            editMode = on;
            document.body.classList.toggle("edit-mode", on);
            const btn = el("editToggleBtn");
            btn.textContent = on ? "SAVE" : "EDIT";
            btn.classList.toggle("done", on);
            btn.setAttribute("aria-pressed", on ? "true" : "false");
            updateCollNameReadonly();
            render(); // rebuild calendar HTML (inputs vs text for paid events)
          }

export function toggleEditMode() {
            if (editMode) {
              saveState();
              setEditMode(false);
              UI.toast("success", "Changes saved", 2200);
            } else {
              setEditMode(true);
            }
          }

export function saveState() {
            if (!state._meta) state._meta = { v: 0, savedAt: null, syncedAt: null };
            state._meta.v       = (state._meta.v || 0) + 1;
            state._meta.savedAt = new Date().toISOString();
            try {
              localStorage.setItem(STORE_KEY, JSON.stringify(state));
              if (!fbEnabled) {
                el("saveDot").className = "dot";
                el("saveTxt").textContent =
                  "Saved ✓ " +
                  new Date().toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
              }
            } catch {
              el("saveDot").className = "dot warn";
              el("saveTxt").textContent = "Storage blocked — data won’t persist";
            }
            scheduleCloudSave();
          }

export function deployable(fid) {
            const s = state.liquid[fid];
            return Math.max(0, (s.value || 0) - (s.reserve || 0));
          }

export function fundName(id) {
            const liq = LIQ_FUNDS.find((f) => f.id === id);
            if (liq) return state.liquid[id]?.name || liq.defaultName;
            const eq = EQ_FUNDS.find((f) => f.id === id);
            return eq ? state.equity[id]?.name || eq.defaultName : id;
          }

export function snapshotKey() {
            const d = new Date();
            const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
            return prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
          }

export function getFundName(fundId) {
            const liq = LIQ_FUNDS.find(f => f.id === fundId);
            if (liq) return state.liquid[fundId]?.name || liq.defaultName;
            const eq = EQ_FUNDS.find(f => f.id === fundId);
            if (eq) return state.equity[fundId]?.name || eq.defaultName;
            return fundId;
          }

export let privacyMode = true;

export function setPrivacyMode(v) { privacyMode = v; }
