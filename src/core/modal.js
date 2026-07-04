import { UI } from "./ui.js";

/* ═══════════════════════════════════════════════════════════════
   Reusable modal system — two presentational variants sharing one
   engine (focus trap, ESC, overlay-click, scroll lock, stacking):
     - open()    generic dialog  (.modal-overlay / .modal-card)
     - confirm() yes/no dialog   (.confirm-overlay / .confirm-card)
     - alert()   single-button info dialog, built on confirm()
   ═══════════════════════════════════════════════════════════════ */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZES = { sm: "360px", md: "480px", lg: "640px" };

let uid = 0;
const nextId = (prefix) => `${prefix}-${++uid}`;

// Stack of open dialogs, topmost last — drives ESC / Tab-trap / scroll lock.
const stack = [];
let scrollLocks = 0;

function lockScroll() {
  if (scrollLocks++ === 0) document.documentElement.style.overflow = "hidden";
}
function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.documentElement.style.overflow = "";
}

function focusableIn(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (n) => n.offsetParent !== null
  );
}

// Single delegated listener handles ESC + Tab-trapping for whichever
// dialog is topmost, however many are stacked.
document.addEventListener(
  "keydown",
  (e) => {
    const top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === "Escape") {
      if (top.dismissible) { e.stopPropagation(); top.close(); }
      return;
    }
    if (e.key === "Tab") {
      const items = focusableIn(top.card);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  },
  true
);

function make(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function fillContent(target, content, emptyState) {
  target.innerHTML = "";
  const isEmpty = content == null || content === "";
  if (isEmpty && emptyState) {
    target.innerHTML = UI.emptyState(
      emptyState.icon || "🗂️",
      emptyState.title || "Nothing here",
      emptyState.body || ""
    );
  } else if (typeof content === "string") {
    target.innerHTML = content;
  } else if (content instanceof Node) {
    target.appendChild(content);
  } else if (typeof content === "function") {
    content(target);
  }
}

// A footer button whose onClick returns a Promise auto-disables the
// whole button row and reports failures via toast, without closing
// the dialog early — so async confirm actions can't be double-fired
// and a network error doesn't silently vanish behind a closed modal.
function buildButton(cfg, close) {
  const variant = cfg.variant || "ghost";
  const b = make("button", "btn " + (variant === "primary" ? "btn-primary" : "btn-ghost"));
  b.type = "button";
  b.textContent = cfg.label;
  if (variant === "danger") b.style.color = "var(--coral)";
  if (cfg.autofocus) b.dataset.autofocus = "true";
  b.addEventListener("click", async () => {
    if (!cfg.onClick) { if (cfg.closesModal !== false) close(); return; }
    let ret;
    try {
      ret = cfg.onClick();
    } catch (err) {
      UI.toast("err", (err && err.message) || "Something went wrong", 4000);
      return;
    }
    if (ret && typeof ret.then === "function") {
      const group = b.parentElement;
      const siblings = group ? Array.from(group.querySelectorAll("button")) : [b];
      siblings.forEach((x) => (x.disabled = true));
      try {
        await ret;
        if (cfg.closesModal !== false) close();
      } catch (err) {
        UI.toast("err", (err && err.message) || "Something went wrong", 4000);
      } finally {
        siblings.forEach((x) => (x.disabled = false));
      }
    } else if (cfg.closesModal !== false) {
      close();
    }
  });
  return b;
}

/**
 * Open a generic modal dialog.
 *
 * @param {object}   opts
 * @param {string}   opts.title
 * @param {string|Node|((body:HTMLElement)=>void)} opts.body
 * @param {Array<{label:string, variant?:"primary"|"ghost"|"danger", onClick?:Function, autofocus?:boolean, closesModal?:boolean}>|false} [opts.footer]
 * @param {"sm"|"md"|"lg"} [opts.size]
 * @param {boolean}  [opts.dismissible]        ESC / overlay-click / X close it (default true)
 * @param {boolean}  [opts.closeOnOverlayClick] defaults to `dismissible`
 * @param {{icon?:string, title?:string, body?:string}} [opts.emptyState] shown when `body` is empty
 * @param {string|HTMLElement} [opts.initialFocus] selector (within the card) or element to focus on open
 * @param {() => void} [opts.onClose]
 * @returns {{el:HTMLElement, close:Function, setTitle:Function, setBody:Function, setFooter:Function, setLoading:Function}}
 */
export function open(opts = {}) {
  const {
    title = "",
    body = "",
    footer = [],
    size = "md",
    dismissible = true,
    closeOnOverlayClick = dismissible,
    onClose,
    initialFocus,
    emptyState = null,
  } = opts;

  const titleId = nextId("modal-title");
  const bodyId = nextId("modal-body");

  const overlay = make("div", "modal-overlay");
  const card = make("div", "modal-card");
  card.style.maxWidth = SIZES[size] || SIZES.md;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-describedby", bodyId);
  if (title) card.setAttribute("aria-labelledby", titleId);
  card.tabIndex = -1;

  const head = make("div", "modal-head");
  const titleEl = make("span", "modal-title");
  titleEl.id = titleId;
  titleEl.textContent = title;
  const closeBtn = make("button", "modal-close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "✕";
  head.append(titleEl, closeBtn);

  const bodyEl = make("div", "modal-body");
  bodyEl.id = bodyId;

  const footEl = make("div", "modal-foot");

  card.append(head, bodyEl, footEl);
  overlay.append(card);
  document.body.appendChild(overlay);

  const previouslyFocused = document.activeElement;
  const entry = { card, dismissible, close: closeModal };
  stack.push(entry);
  lockScroll();

  function renderFooter(buttons) {
    footEl.innerHTML = "";
    if (buttons === false || (Array.isArray(buttons) && buttons.length === 0)) {
      footEl.style.display = "none";
      return;
    }
    footEl.style.display = "";
    buttons.forEach((cfg) => footEl.appendChild(buildButton(cfg, closeModal)));
  }

  function closeModal() {
    if (entry.closed) return;
    entry.closed = true;
    const idx = stack.indexOf(entry);
    if (idx !== -1) stack.splice(idx, 1);
    unlockScroll();
    overlay.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
    if (onClose) onClose();
  }

  closeBtn.addEventListener("click", closeModal);
  if (closeOnOverlayClick) {
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  }

  fillContent(bodyEl, body, emptyState);
  renderFooter(footer);

  requestAnimationFrame(() => {
    const target =
      typeof initialFocus === "string" ? card.querySelector(initialFocus) : initialFocus;
    (target || focusableIn(card)[0] || card).focus();
  });

  return {
    el: overlay,
    close: closeModal,
    setTitle(t) { titleEl.textContent = t; },
    setBody(content, es) { fillContent(bodyEl, content, es ?? emptyState); },
    setFooter(buttons) { renderFooter(buttons); },
    setLoading(isLoading) {
      if (isLoading) {
        bodyEl.dataset.savedHtml = bodyEl.innerHTML;
        bodyEl.innerHTML = UI.skeleton(2);
        footEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
      } else {
        if (bodyEl.dataset.savedHtml != null) {
          bodyEl.innerHTML = bodyEl.dataset.savedHtml;
          delete bodyEl.dataset.savedHtml;
        }
        footEl.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    },
  };
}

const DANGER_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const INFO_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

/**
 * Yes/No confirmation dialog. Drop-in compatible with the legacy
 * `UI.confirm(msg, title, okLabel, cb, danger)` call signature — `cb`
 * still fires on confirm — but also returns a Promise<boolean> for
 * new call sites that want to `await` the user's choice.
 *
 * If `cb` returns a Promise, both buttons disable until it settles;
 * a rejection toasts the error and leaves the dialog open instead of
 * closing on a failed action.
 */
export function confirm(msg, title, okLabel, cb, danger = true, { showCancel = true } = {}) {
  return new Promise((resolve) => {
    const overlay = make("div", "confirm-overlay");
    const card = make("div", "confirm-card");
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-modal", "true");
    card.tabIndex = -1;

    const titleId = nextId("confirm-title");
    const msgId = nextId("confirm-msg");
    card.setAttribute("aria-labelledby", titleId);
    card.setAttribute("aria-describedby", msgId);

    const iconWrap = make("div", "confirm-icon-wrap" + (danger ? "" : " info-type"));
    iconWrap.innerHTML = danger ? DANGER_ICON : INFO_ICON;

    const titleEl = make("div", "confirm-title");
    titleEl.id = titleId;
    titleEl.textContent = title || "Are you sure?";

    const msgEl = make("div", "confirm-msg");
    msgEl.id = msgId;
    msgEl.textContent = msg || "";

    const btns = make("div", "confirm-btns");
    const cancelBtn = make("button", "confirm-cancel-btn");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    const okBtn = make("button", "confirm-ok-btn " + (danger ? "is-danger" : "is-primary"));
    okBtn.type = "button";
    okBtn.textContent = okLabel || "Confirm";
    if (showCancel) btns.append(cancelBtn, okBtn);
    else btns.append(okBtn);

    card.append(iconWrap, titleEl, msgEl, btns);
    overlay.append(card);
    document.body.appendChild(overlay);

    const previouslyFocused = document.activeElement;
    const entry = { card, dismissible: true, close: closeModal };
    stack.push(entry);
    lockScroll();

    let settled = false;
    function closeModal() {
      if (entry.closed) return;
      entry.closed = true;
      const idx = stack.indexOf(entry);
      if (idx !== -1) stack.splice(idx, 1);
      unlockScroll();
      overlay.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
      if (!settled) { settled = true; resolve(false); }
    }

    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

    okBtn.addEventListener("click", async () => {
      let ret;
      try {
        ret = cb ? cb() : undefined;
      } catch (err) {
        UI.toast("err", (err && err.message) || "Something went wrong", 4000);
        return;
      }
      if (ret && typeof ret.then === "function") {
        cancelBtn.disabled = true;
        okBtn.disabled = true;
        try {
          await ret;
          settled = true;
          resolve(true);
          closeModal();
        } catch (err) {
          UI.toast("err", (err && err.message) || "Something went wrong", 4000);
        } finally {
          cancelBtn.disabled = false;
          okBtn.disabled = false;
        }
      } else {
        settled = true;
        resolve(true);
        closeModal();
      }
    });

    requestAnimationFrame(() => okBtn.focus());
  });
}

/** Single-button info dialog, built on confirm()'s visuals. */
export function alert(msg, title, okLabel = "OK") {
  return confirm(msg, title, okLabel, undefined, false, { showCancel: false }).then(() => undefined);
}

export const Modal = { open, confirm, alert };
