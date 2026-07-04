import { EQ_FUNDS, LIQ_FUNDS, saveState, state } from "../../core/state.js";
import { UI, collapseTxpCard, expandTxpCard, navigateTo } from "../../core/ui.js";
import { el } from "../../core/dom.js";
import { fmt, num } from "../../core/format.js";
import { renderCalendar } from "./calendar.js";

export function openManageSips() {
            const sections = [
              { label: "Liquid Funds", funds: LIQ_FUNDS, stateKey: "liquid" },
              { label: "Equity Funds", funds: EQ_FUNDS,  stateKey: "equity" },
            ];
            let html = "";
            sections.forEach(sec => {
              html += `<div class="sip-section-label">${sec.label}</div>`;
              sec.funds.forEach(f => {
                const s = state[sec.stateKey][f.id];
                const name = s.name || s.label || f.defaultName;
                const amt  = s.sipAmt  || 0;
                const date = s.sipDate || "";
                html += `<div class="sip-fund-row">
                  <span class="sip-fund-name">${name}</span>
                  <div class="sip-inp-wrap">
                    <span class="sip-inp-label">₹</span>
                    <div class="sip-amt-box">
                      <input class="sip-amt-inp" id="siamt-${f.id}" type="text" inputmode="numeric"
                        placeholder="0" value="${amt > 0 ? Math.round(amt).toLocaleString("en-IN") : ""}" />
                    </div>
                    <span class="sip-inp-label">on</span>
                    <select class="sip-date-inp" id="sidate-${f.id}">
                      <option value="">—</option>
                      ${Array.from({length:31},(_,i)=>`<option value="${i+1}"${(date&&parseInt(date)===i+1)?' selected':''}>Day ${i+1}</option>`).join("")}
                    </select>
                  </div>
                </div>`;
              });
            });
            const sipTotal = [...LIQ_FUNDS, ...EQ_FUNDS].reduce((s, f) => {
              const isLiq = LIQ_FUNDS.some(x => x.id === f.id);
              return s + ((isLiq ? state.liquid[f.id] : state.equity[f.id]).sipAmt || 0);
            }, 0);
            html += `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--dim);">Total Monthly SIP</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;color:var(--mint);">${fmt(sipTotal)}</span>
            </div>`;
            el("sipModalBody").innerHTML = html;
            navigateTo("transactions");
            expandTxpCard("txp-sip");
          }

export function saveManageSips() {
            [...LIQ_FUNDS, ...EQ_FUNDS].forEach(f => {
              const isLiq = LIQ_FUNDS.some(x => x.id === f.id);
              const s = isLiq ? state.liquid[f.id] : state.equity[f.id];
              const amtInp  = el("siamt-"  + f.id);
              const dateInp = el("sidate-" + f.id);
              if (!amtInp) return;
              s.sipAmt  = num(amtInp.value);
              s.sipDate = parseInt(dateInp.value) || 0;
            });
            saveState();
            renderCalendar();
            collapseTxpCard("txp-sip");
            UI.toast("success", "SIPs saved", 1800);
          }
