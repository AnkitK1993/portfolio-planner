import { el } from "../../core/dom.js";
import { UI } from "../../core/ui.js";

(function initPinLock() {
            let _pinBuffer = "";
            const PIN_KEY = "appPin";
            const storedPin = localStorage.getItem(PIN_KEY);
            const overlay = el("pinOverlay");
            if (!overlay) return;

            const updateDots = () => {
              const dotsEl = el("pinDots");
              if (!dotsEl) return;
              dotsEl.innerHTML = [0,1,2,3].map(i =>
                `<div class="pin-dot${_pinBuffer.length > i ? " filled" : ""}"></div>`
              ).join("");
            };

            if (storedPin) {
              overlay.style.display = "flex";
              updateDots();
              document.querySelectorAll(".pin-key").forEach(btn => {
                btn.addEventListener("click", () => {
                  const k = btn.dataset.k;
                  if (k === "" || k === undefined) return;
                  if (k === "back") { _pinBuffer = _pinBuffer.slice(0,-1); updateDots(); el("pinError").textContent = ""; return; }
                  if (_pinBuffer.length >= 4) return;
                  _pinBuffer += k;
                  updateDots();
                  if (_pinBuffer.length === 4) {
                    if (_pinBuffer === storedPin) {
                      overlay.style.display = "none";
                    } else {
                      el("pinError").textContent = "Incorrect PIN. Try again.";
                      _pinBuffer = "";
                      setTimeout(updateDots, 50);
                    }
                  }
                });
              });
            }

            // PIN management from admin menu
            window.setAppPin = (newPin) => {
              if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { UI.toast("err", "PIN must be exactly 4 digits", 3000); return; }
              localStorage.setItem(PIN_KEY, newPin);
              UI.toast("success", "PIN set successfully", 2500);
            };
            window.clearAppPin = () => { localStorage.removeItem(PIN_KEY); UI.toast("success", "PIN removed", 2500); };
          })();
