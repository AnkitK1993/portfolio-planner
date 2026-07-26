import { editMode, saveState, state } from "./state.js";

// Reorderable card groups, keyed by tab name — registered once at boot
// (main.js) with each tab's cards in their default DOM order. A small
// "⇅ Reorder ▲▼" bar is prepended to each card, shown only in edit mode
// — up/down arrows rather than drag-and-drop, since that needs no extra
// library and works identically on touch and mouse.
const registry = {};

function currentOrder(tabName) {
            const defaultIds = registry[tabName];
            const saved = state.cardOrder?.[tabName];
            const valid = Array.isArray(saved) && saved.length === defaultIds.length && defaultIds.every(id => saved.includes(id));
            return valid ? saved : defaultIds;
          }

function ensureBars(tabName) {
            registry[tabName].forEach(id => {
              const cardEl = document.getElementById(id);
              if (!cardEl || cardEl.querySelector(":scope > .card-reorder-bar")) return;
              const bar = document.createElement("div");
              bar.className = "card-reorder-bar";
              bar.innerHTML = `<span>&#8645; Reorder</span><div>
                <button type="button" class="card-reorder-up" aria-label="Move card up">&#9650;</button>
                <button type="button" class="card-reorder-down" aria-label="Move card down">&#9660;</button>
              </div>`;
              cardEl.insertBefore(bar, cardEl.firstChild);
              bar.querySelector(".card-reorder-up").addEventListener("click", (e) => { e.stopPropagation(); moveCard(tabName, id, -1); });
              bar.querySelector(".card-reorder-down").addEventListener("click", (e) => { e.stopPropagation(); moveCard(tabName, id, 1); });
            });
          }

// Moves each card to the end of its parent, in order — appendChild() on
// a node already in the DOM relocates it rather than cloning it, so
// walking the desired order and appending each in turn leaves every card
// as a sibling in exactly that sequence. A no-op (cheap) for any card
// already in the right place, so calling this every render is fine.
export function applyCardOrder(tabName) {
            if (!registry[tabName]) return;
            const order = currentOrder(tabName);
            order.forEach(id => {
              const cardEl = document.getElementById(id);
              if (cardEl?.parentElement) cardEl.parentElement.appendChild(cardEl);
            });
            order.forEach((id, i) => {
              const cardEl = document.getElementById(id);
              const bar = cardEl?.querySelector(":scope > .card-reorder-bar");
              if (!bar) return;
              bar.style.display = editMode ? "flex" : "none";
              bar.querySelector(".card-reorder-up").disabled = i === 0;
              bar.querySelector(".card-reorder-down").disabled = i === order.length - 1;
            });
          }

// Called from the global render() so every tab's order + bar visibility
// stays in sync with editMode and with state.cardOrder — including after
// a cloud sync applies another device's saved order.
export function applyAllCardOrders() {
            Object.keys(registry).forEach(applyCardOrder);
          }

export function registerCardOrder(tabName, defaultIds) {
            registry[tabName] = defaultIds;
            ensureBars(tabName);
            applyCardOrder(tabName);
          }

function moveCard(tabName, id, dir) {
            const order = [...currentOrder(tabName)];
            const i = order.indexOf(id);
            const j = i + dir;
            if (j < 0 || j >= order.length) return;
            [order[i], order[j]] = [order[j], order[i]];
            if (!state.cardOrder) state.cardOrder = {};
            state.cardOrder[tabName] = order;
            saveState();
            applyCardOrder(tabName);
          }
