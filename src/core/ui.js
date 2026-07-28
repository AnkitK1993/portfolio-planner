import { EQ_FUNDS, LIQ_FUNDS, editMode } from "./state.js";
import { el } from "./dom.js";
import { onTabActivate, triggerRender } from "./appEvents.js";
import { setAnimOnRender } from "./animate.js";
import { confirm as modalConfirm, open as modalOpen, registerOverlay } from "./modal.js";

export const UI = {
            /* Custom confirmation dialog — see core/modal.js for the implementation */
            confirm(msg, title, okLabel, cb, danger = true) {
              return modalConfirm(msg, title, okLabel, cb, danger);
            },

            /* Wire a static always-in-DOM modal into the shared ESC/Tab-
               trap/scroll-lock stack — see core/modal.js's registerOverlay */
            registerOverlay(overlayEl, opts) {
              return registerOverlay(overlayEl, opts);
            },

            /* Closes a registerOverlay()'d modal from anywhere holding the
               same element reference, without needing the controller
               object threaded through as an argument — e.g. an async
               success callback in a completely different module. No-op if
               that element was never registered. */
            closeOverlay(overlayEl) {
              overlayEl?._modalCtl?.close();
            },

            /* Symmetrical opener — e.g. openTxnModal() populating the
               transaction form then opening #txnModal from within the same
               module that will later call closeOverlay() on it. */
            openOverlay(overlayEl) {
              overlayEl?._modalCtl?.open();
            },

            /* Single-line text input dialog — a styled replacement for the
               native prompt() (which is the one place in this app that
               broke out of the custom modal system into a jarring browser-
               chrome dialog). Promise<string|null>, null meaning
               cancelled/dismissed, matching prompt()'s own contract so
               call sites barely change. */
            prompt(title, message, { placeholder = "", defaultValue = "" } = {}) {
              return new Promise((resolve) => {
                let resolved = false;
                let inputEl;
                const handle = modalOpen({
                  title,
                  body: (target) => {
                    target.innerHTML = `<p style="font-size:11.5px;color:var(--dim);margin-bottom:10px;">${message}</p>
                      <input type="text" style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--txt);font-family:'Roboto Mono',monospace;font-size:14px;padding:9px 12px;" placeholder="${placeholder}" />`;
                    inputEl = target.querySelector("input");
                    inputEl.value = defaultValue;
                    inputEl.addEventListener("keydown", (e) => {
                      if (e.key === "Enter") { resolved = true; resolve(inputEl.value); handle.close(); }
                    });
                  },
                  footer: [
                    { label: "Cancel", variant: "ghost" },
                    { label: "OK", variant: "primary", onClick: () => { resolved = true; resolve(inputEl.value); } },
                  ],
                  initialFocus: "input",
                  onClose: () => { if (!resolved) resolve(null); },
                });
              });
            },

            /* Select-to-copy fallback — for anywhere navigator.clipboard is
               blocked/unavailable (insecure context, permission denied) and
               the user still needs the text. Keeps that failure path inside
               this app's own modal system instead of a jarring native
               alert(), which is otherwise unused everywhere else here. */
            showText(title, text) {
              modalOpen({
                title,
                body: (target) => {
                  target.innerHTML = `<p style="font-size:11px;color:var(--dim);margin-bottom:8px;">Clipboard access was blocked — select the text below and copy it manually.</p>
                    <textarea readonly style="width:100%;min-height:160px;background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--txt);font-family:'Roboto Mono',monospace;font-size:11px;padding:10px;resize:vertical;"></textarea>`;
                  const ta = target.querySelector("textarea");
                  ta.value = text;
                  ta.addEventListener("focus", () => ta.select());
                },
                footer: [{ label: "Close", variant: "primary" }],
                initialFocus: "textarea",
              });
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

            /* Toast with an "Undo" action — for deletions that take effect
               immediately (no confirm dialog) but stay reversible for a
               short window. onUndo is called at most once, either from the
               button or from a caller re-using the returned handle; the
               toast self-dismisses (without calling onUndo) once duration
               elapses, at which point the deletion is final. */
            undoToast(msg, onUndo, duration = 6000) {
              const wrap = document.getElementById("toastWrap");
              if (!wrap) return;
              const div = document.createElement("div");
              div.className = "toast toast-info";
              div.setAttribute("role", "status");
              div.style.setProperty("--toast-dur", (duration / 1000) + "s");
              div.innerHTML =
                `<span class="toast-icon" aria-hidden="true">i</span>` +
                `<span class="toast-msg">${msg}</span>` +
                `<button class="toast-undo">Undo</button>` +
                `<button class="toast-x" aria-label="Dismiss">✕</button>`;
              let settled = false;
              const dismiss = () => {
                div.classList.add("toast-exit");
                setTimeout(() => div.remove(), 240);
              };
              div.querySelector(".toast-x").addEventListener("click", dismiss);
              div.querySelector(".toast-undo").addEventListener("click", () => {
                if (settled) return;
                settled = true;
                onUndo();
                dismiss();
              });
              wrap.appendChild(div);
              setTimeout(dismiss, duration);
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
            el("planningBtn").classList.toggle("active", tabId === "forecast");
            el("txnsBtn").classList.toggle("active", tabId === "transactions");
            el("adminBtn").classList.remove("active");
            setAnimOnRender(true); // trigger count-up animation on tab enter
            onTabActivate(tabId);
            closeNavDropdowns();
            triggerRender(); // re-render with _animOnRender = true so all animations fire
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

export function updateCollNameReadonly() {
            [...LIQ_FUNDS, ...EQ_FUNDS].forEach(f => {
              const inp = el("coll-name-" + f.id);
              if (inp) inp.readOnly = !editMode;
            });
          }
