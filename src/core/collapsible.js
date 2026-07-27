// Reusable, framework-free collapsible/accordion behavior.
//
// Decorates an existing <button> header + content element pair — it does
// not create any DOM itself, so it works equally well with hard-coded
// index.html markup (Expenses card, Holdings widget) and with dynamically
// generated markup (per-fund coll-sections built in features/portfolio/
// funds.js). This consolidates three previously-separate, slightly
// different hand-rolled toggle implementations in the app into one
// tested, accessible behavior.

/**
 * @typedef {Object} CollapsibleOptions
 * @property {HTMLButtonElement} header
 *   The clickable header. Must be a real <button> — native keyboard
 *   (Enter/Space) and screen-reader semantics come for free that way.
 *   A non-button element is left un-wired and logs a console.warn rather
 *   than silently shipping a header keyboard users can't operate.
 * @property {HTMLElement} body
 *   The element whose content is shown/hidden.
 * @property {boolean} [defaultOpen=false]
 *   Initial state when the collapsible is created.
 * @property {HTMLElement|null} [collapsedSummary=null]
 *   Optional element (typically living inside `header`) that's shown only
 *   while collapsed and hidden while open — e.g. a "Total This Month
 *   ₹58,000" preview so the figure stays visible without expanding.
 * @property {(open: boolean) => void} [onToggle]
 *   Called after every state change, whether from a user click or a
 *   programmatic open()/close()/toggle() call.
 * @property {string} [openClass="open"]
 *   Class applied to both `header` and `body` while open. Matches the
 *   `.open` convention already used by `.coll-head`/`.coll-body` and the
 *   Expenses/Holdings cards, so existing CSS (chevron rotation, etc.)
 *   keeps working unchanged.
 */

/**
 * @param {CollapsibleOptions} opts
 * @returns {{
 *   open(): void,
 *   close(): void,
 *   toggle(): void,
 *   isOpen(): boolean,
 *   refresh(): void,
 *   destroy(): void,
 * }}
 */
export function createCollapsible({
  header,
  body,
  defaultOpen = false,
  collapsedSummary = null,
  onToggle,
  openClass = "open",
}) {
  if (!header || !body) {
    throw new Error("createCollapsible: both `header` and `body` are required");
  }
  if (header.tagName !== "BUTTON") {
    // A non-button header would need its own tabindex/role/keydown
    // handling to be keyboard-accessible — rather than silently
    // reimplementing that (and likely getting an edge case wrong), fail
    // loud in development so the caller fixes the markup instead.
    console.warn("createCollapsible: `header` should be a <button> for built-in keyboard/AT support:", header);
  }

  let isOpen = !!defaultOpen;
  let resizeObserver = null;

  function watchHeight() {
    if (resizeObserver || typeof ResizeObserver === "undefined") return;
    // Content can change size while expanded (e.g. the Expenses card's
    // Trends section re-rendering with a different period selected) — a
    // fixed max-height guess would either clip new content or leave dead
    // space. Tracking scrollHeight live keeps the animation correct
    // without callers needing to remember to call refresh() themselves.
    resizeObserver = new ResizeObserver(() => {
      if (isOpen) body.style.maxHeight = body.scrollHeight + "px";
    });
    resizeObserver.observe(body);
  }

  function unwatchHeight() {
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  function apply() {
    header.classList.toggle(openClass, isOpen);
    body.classList.toggle(openClass, isOpen);
    header.setAttribute("aria-expanded", String(isOpen));
    if (collapsedSummary) collapsedSummary.style.display = isOpen ? "none" : "";
    if (isOpen) {
      body.style.maxHeight = body.scrollHeight + "px";
      watchHeight();
    } else {
      unwatchHeight();
      body.style.maxHeight = "0px";
    }
  }

  function setOpen(next) {
    if (next === isOpen) return;
    isOpen = next;
    apply();
    onToggle?.(isOpen);
  }

  if (body.id) header.setAttribute("aria-controls", body.id);
  body.classList.add("acc-body");
  header.classList.add("acc-header");
  const onClick = () => setOpen(!isOpen);
  header.addEventListener("click", onClick);
  apply();

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!isOpen),
    isOpen: () => isOpen,
    // Recompute the open height on demand — only needed for content
    // changes the ResizeObserver can't see (e.g. swapping `body` for a
    // fresh element via innerHTML replacement of an ancestor). Safe to
    // call unconditionally; a no-op while collapsed.
    refresh: () => { if (isOpen) body.style.maxHeight = body.scrollHeight + "px"; },
    destroy: () => {
      header.removeEventListener("click", onClick);
      unwatchHeight();
    },
  };
}

// Standalone version of the `refresh()` method above, for content nested
// inside a createCollapsible() body that a *different* module owns (e.g.
// a per-row expand/collapse inside a card whose outer open/close toggle
// was wired up elsewhere, in main.js). The ResizeObserver that keeps an
// open .card-toggle-body's max-height in sync only fires when the
// observed box's own size changes — while it's open, that box is pinned
// to a fixed max-height, so content growing *inside* it (expanding one
// more row) never changes the observed box and the observer never fires,
// silently clipping the new content. Call this after mutating anything
// inside such a body whose height can change while open.
export function refreshAncestorCollapsible(contentEl) {
  const body = contentEl?.closest(".card-toggle-body");
  if (body && body.classList.contains("open")) {
    body.style.maxHeight = body.scrollHeight + "px";
  }
}
