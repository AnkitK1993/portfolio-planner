import { EQ_FUNDS, LIQ_FUNDS, editMode } from "./state.js";
import { el } from "./dom.js";
import { renderTxns } from "../features/transactions/index.js";
import { scheduleRender } from "../features/portfolio/render.js";
import { setAnimOnRender } from "./animate.js";
import { confirm as modalConfirm } from "./modal.js";

export const UI = {
            /* Custom confirmation dialog — see core/modal.js for the implementation */
            confirm(msg, title, okLabel, cb, danger = true) {
              return modalConfirm(msg, title, okLabel, cb, danger);
            },

            /* Floating toast notification — type: success | error | info | warn */
            toast(type, msg, duration = 3500) {
              const wrap = document.getElementById("toastWrap");
              if (!wrap) return;
              const icons = { success: "✓", error: "✕", err: "✕", info: "i", warn: "!" };
              const div = document.createElement("div");
              div.className = "toast toast-" + type;
              div.setAttribute("role", "status");
              div.style.setProperty("--toast-dur", (duration / 1000) + "s");
              div.innerHTML =
                `<span class="toast-icon" aria-hidden="true">${icons[type] ?? "i"}</span>` +
                `<span class="toast-msg">${msg}</span>` +
                `<button class="toast-x" aria-label="Dismiss">✕</button>`;
              const dismiss = () => {
                div.classList.add("toast-exit");
                setTimeout(() => div.remove(), 240);
              };
              div.querySelector(".toast-x").addEventListener("click", dismiss);
              wrap.appendChild(div);
              if (duration > 0) setTimeout(dismiss, duration);
            },

            /* Shimmer skeleton placeholder — drop into any grid while loading */
            skeleton(count = 2) {
              return Array.from({ length: count }, () =>
                `<div class="skeleton-card" aria-hidden="true">
                  <div class="skel skel-title"></div>
                  <div class="skel skel-input"></div>
                  <div class="skel skel-input skel-short"></div>
                  <div class="skel skel-chip"></div>
                </div>`
              ).join("");
            },

            /* Consistent empty state block */
            emptyState(icon, title, body) {
              return `<div class="empty-state" role="status" aria-label="${title}">
                <div class="empty-icon" aria-hidden="true">${icon}</div>
                <p class="empty-title">${title}</p>
                <p class="empty-body">${body}</p>
              </div>`;
            },
          };

export let _openNavDd = null;

export function navigateTo(tabId) {
            document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
            el("tab-" + tabId).classList.add("active");
            el("homeBtn").classList.toggle("active", tabId === "portfolio");
            el("summaryBtn").classList.toggle("active", tabId === "summary");
            el("networthBtn").classList.toggle("active", tabId === "networth");
            el("ddForecastBtn").classList.toggle("active", tabId === "forecast");
            el("txnsBtn").classList.toggle("active", tabId === "transactions");
            el("adminBtn").classList.remove("active");
            setAnimOnRender(true); // trigger count-up animation on tab enter
            if (tabId === "transactions") {
              el("txnTabInvest").classList.add("active");
              el("txnTabReturns").classList.remove("active");
              el("txnList").style.display = "";
              el("txnFilters").style.display = "";
              el("returnsList").style.display = "none";
              renderTxns();
            } else if (tabId === "summary") {
              renderTxns();
            }
            closeNavDropdowns();
            scheduleRender(); // re-render with _animOnRender = true so all animations fire
          }

export function openNavDropdown(ddId, triggerEl) {
            if (_openNavDd === ddId) { closeNavDropdowns(); return; }
            closeNavDropdowns();
            _openNavDd = ddId;
            const dd = el(ddId);
            dd.style.display = "block";
            const rect = triggerEl.getBoundingClientRect();
            const ddW = dd.offsetWidth || 160;
            const ddH = dd.offsetHeight || 200;
            let left = rect.left;
            if (left + ddW > window.innerWidth - 8) left = window.innerWidth - ddW - 8;
            if (left < 8) left = 8;
            dd.style.left = left + "px";
            // Open upward vs downward based on actual room in the viewport,
            // not a screen-width breakpoint — the nav bar is pinned to the
            // bottom of the viewport on every screen size (not just narrow
            // ones), so a width check alone can pick "open downward" for a
            // trigger that has no room below, rendering the menu off-screen.
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpward = spaceBelow < ddH + 16 && rect.top > ddH + 16;
            if (openUpward) {
              dd.style.bottom = (window.innerHeight - rect.top + 8) + "px";
              dd.style.top = "auto";
            } else {
              dd.style.top = (rect.bottom + 6) + "px";
              dd.style.bottom = "auto";
            }
            triggerEl.classList.add("dd-open");
          }

export function closeNavDropdowns() {
            if (_openNavDd) { const d = el(_openNavDd); if (d) d.style.display = "none"; _openNavDd = null; }
            ["adminBtn"].forEach(id => { const b = el(id); if (b) b.classList.remove("dd-open"); });
          }

export function expandTxpCard(id) { const c = el(id); if (c) c.classList.add("open"); }

export function collapseTxpCard(id) { const c = el(id); if (c) c.classList.remove("open"); }

export function toggleColl(id) {
            const head = el("coll-head-" + id);
            const body = el("coll-body-" + id);
            if (!head || !body) return;
            const opening = !body.classList.contains("open");
            body.classList.toggle("open", opening);
            head.classList.toggle("open", opening);
            head.setAttribute("aria-expanded", String(opening));
          }

export function updateCollNameReadonly() {
            [...LIQ_FUNDS, ...EQ_FUNDS].forEach(f => {
              const inp = el("coll-name-" + f.id);
              if (inp) inp.readOnly = !editMode;
            });
          }
