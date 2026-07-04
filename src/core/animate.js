import { editMode } from "./state.js";
import { fmt } from "./format.js";
import { render } from "../features/portfolio/render.js";

export const _animRaf = {};

export let _animOnRender = true;

export function setAnimOnRender(v) { _animOnRender = v; }

export function animateNumber(targetEl, toVal, duration = 600, fromZero = false, prefix = "", plain = false) {
            if (!targetEl) return;
            // Stable per-element key using a lazily assigned counter
            if (!targetEl._ak) targetEl._ak = ++animateNumber._ctr;
            const key = targetEl._ak;
            if (_animRaf[key]) cancelAnimationFrame(_animRaf[key]);

            // Support fmtInner containers: animate the inner .val-num span
            const numSpan = (typeof targetEl.querySelector === "function")
              ? targetEl.querySelector(".val-num") : null;
            const renderEl = numSpan || targetEl;
            const render = (v) => numSpan || plain
              ? Math.round(v).toLocaleString("en-IN")
              : prefix + fmt(Math.round(v));

            const fromVal = fromZero ? 0
              : (parseFloat(renderEl.textContent.replace(/[₹,+\-,\s]/g, "")) || 0);
            if (!fromZero && Math.abs(toVal - fromVal) < 1) {
              renderEl.textContent = render(toVal);
              return;
            }

            const start = performance.now();
            const tick = (now) => {
              // innerHTML rebuilds (e.g. renderHealthScore) can destroy this
              // element mid-animation while a stale closure keeps ticking
              // against it — bail out instead of wasting rAF cycles forever.
              if (!renderEl.isConnected) { delete _animRaf[key]; return; }
              const t = Math.min(1, (now - start) / duration);
              const ease = 1 - Math.pow(1 - t, 3);
              const cur = fromVal + (toVal - fromVal) * ease;
              renderEl.textContent = render(cur);
              if (t < 1) _animRaf[key] = requestAnimationFrame(tick);
              else delete _animRaf[key];
            };
            _animRaf[key] = requestAnimationFrame(tick);
          }

export function animateWidth(targetEl, toPct, duration = 900) {
            if (!targetEl) return;
            if (!targetEl._ak) targetEl._ak = ++animateNumber._ctr;
            const key = "w" + targetEl._ak;
            if (_animRaf[key]) cancelAnimationFrame(_animRaf[key]);
            targetEl.style.transition = "none";
            targetEl.style.width = "0%";
            const start = performance.now();
            const tick = (now) => {
              if (!targetEl.isConnected) { delete _animRaf[key]; return; }
              const t = Math.min(1, (now - start) / duration);
              const ease = 1 - Math.pow(1 - t, 3);
              targetEl.style.width = (toPct * ease).toFixed(1) + "%";
              if (t < 1) _animRaf[key] = requestAnimationFrame(tick);
              else { delete _animRaf[key]; targetEl.style.transition = ""; }
            };
            _animRaf[key] = requestAnimationFrame(tick);
          }

export function setFmtInner(elId, value, fallback = "—") {
            const element = document.getElementById(elId);
            if (!element) return;
            if (value <= 0) { element.innerHTML = fallback; return; }
            if (_animOnRender && !editMode) {
              element.innerHTML = `<span class="val-pfx">₹</span><span class="val-num">0</span>`;
              animateNumber(element, value, 2000, true);
            } else {
              element.innerHTML = `<span class="val-pfx">₹</span><span class="val-num">${Math.round(value).toLocaleString("en-IN")}</span>`;
            }
          }
