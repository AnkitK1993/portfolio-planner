// Reusable named-item CRUD list — the shell logic behind Fixed Expenses,
// Financial Goals, and Loans/EMIs (all three were, before this, separate
// hand-rolled ~120-line implementations of the exact same add/delete/
// empty-state wiring around a state-backed array of {id, ...} objects).
//
// Deliberately headless on data: it never touches `state` or calls
// saveState() itself — onAdd/onDelete are plain callbacks the caller
// wires to whatever persistence + re-render behavior that specific card
// needs (which varies: some cards re-render three sibling cards on a
// change, others don't re-render at all on a name edit to avoid stealing
// focus mid-keystroke). Only genuinely identical concerns live here:
// empty-state text, the "+ Add X" button, and delete-button wiring.
//
// Row content itself (renderRow) stays a render prop rather than a
// declarative field schema — Expenses' category-dot-and-date-tag body,
// Goals' progress-bar-and-ETA-sentence body, and Loans' flat 3-column
// number grid have incompatible shapes, and a schema flexible enough to
// cover all three would need more escape hatches than just writing HTML.
export function renderItemList(containerEl, {
  items,
  editMode,
  renderRow,
  onAdd,
  onDelete,
  addLabel = "+ Add Item",
  emptyEditText = `No items yet — use "${addLabel}" below.`,
  emptyViewText = "No items added. Tap Edit to add one.",
  // Escape hatch: Fixed Expenses' add button had its own pre-existing
  // CSS rule (full-width, tighter margin/font) that Financial Goals and
  // Loans never had — rather than force that look onto every consumer
  // (a visual change for two of the three) or silently drop it for the
  // one that already had it, callers can pass their own class through.
  addBtnClass = "",
  // All three real callers rebuild their OWN outer wrap.innerHTML fresh
  // on every render (to redraw stat grids/hero cards around the list),
  // which recreates containerEl itself as a brand-new, unfocused node
  // before this function ever runs — so checking focus against
  // containerEl here would always be too late. Callers instead check
  // focus against their own stable outer element (looked up by id, so
  // it's the same DOM node across renders) BEFORE smashing their own
  // innerHTML, and hand the result in. Falls back to a self-check for
  // any future caller that does pass a stable, persistent containerEl.
  hadFocusInside,
}) {
            if (!containerEl) return;
            if (hadFocusInside === undefined) hadFocusInside = containerEl.contains(document.activeElement);

            const rowsHtml = items.map(item => renderRow(item, editMode)).join("");
            const emptyHtml = `<p class="item-list-empty" style="font-size:11px;color:var(--dim);padding:8px 0;">
              ${editMode ? emptyEditText : emptyViewText}
            </p>`;

            containerEl.innerHTML = `
              <ul class="item-list" role="list" style="list-style:none;margin:0;padding:0;">
                ${rowsHtml || `<li>${emptyHtml}</li>`}
              </ul>
              ${editMode ? `<button type="button" class="btn btn-ghost item-list-add-btn${addBtnClass ? " " + addBtnClass : ""}">${addLabel}</button>` : ""}
            `;

            // Delete wiring — event delegation on the container itself
            // (data-role/data-id convention the caller's renderRow() must
            // include on its own delete button) rather than one listener
            // per row, so repeated re-renders never accumulate listeners.
            containerEl.querySelectorAll('[data-role="delete-item"]').forEach(btn => {
              btn.addEventListener("click", () => onDelete(btn.dataset.id));
            });

            const addBtn = containerEl.querySelector(".item-list-add-btn");
            if (addBtn) addBtn.addEventListener("click", onAdd);

            if (hadFocusInside) (addBtn || containerEl).focus?.();
          }
