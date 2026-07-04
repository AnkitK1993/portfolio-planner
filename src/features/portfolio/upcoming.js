import { EQ_FUNDS, state } from "../../core/state.js";
import { MONTHS } from "../../core/constants.js";
import { el } from "../../core/dom.js";
import { fmt } from "../../core/format.js";

export function renderUpcoming() {
            const today = new Date();
            const todayDate = today.getDate();
            const todayMid = new Date(
              today.getFullYear(),
              today.getMonth(),
              todayDate,
            );

            function nextOcc(dayOfMonth) {
              if (dayOfMonth > todayDate)
                return new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
              return new Date(
                today.getFullYear(),
                today.getMonth() + 1,
                dayOfMonth,
              );
            }

            function diffLabel(d) {
              const days = Math.round((d - todayMid) / 86400000);
              if (days === 0) return "Today";
              if (days === 1) return "Tomorrow";
              return "in " + days + " days";
            }

            const rows = [];

            /* SIP rows */
            EQ_FUNDS.forEach((f) => {
              const s = state.equity[f.id];
              const sipAmt = s.sipAmt || 0;
              const sipDate = s.sipDate || 0;
              if (sipAmt > 0 && sipDate > 0) {
                const d = nextOcc(sipDate);
                rows.push({
                  type: "sip",
                  name: s.name || f.defaultName,
                  amount: sipAmt,
                  day: sipDate,
                  month: MONTHS[d.getMonth()],
                  diff: diffLabel(d),
                  ts: d.getTime(),
                });
              }
            });

            rows.sort((a, b) => a.ts - b.ts || (a.type === "stp" ? -1 : 1));

            const sec = el("upcomingSection");
            if (!rows.length) {
              sec.innerHTML = "";
              return;
            }

            const rowsHTML = rows
              .map(
                (r) => `
              <div class="upcoming-row">
                <div class="upcoming-dblock">
                  <div class="upcoming-day">${r.day}</div>
                  <div class="upcoming-mo">${r.month}</div>
                </div>
                <span class="tag ${r.type}">${r.type.toUpperCase()}</span>
                <div class="upcoming-name">${r.name}</div>
                <div class="upcoming-amt ${r.type}">${fmt(r.amount)}</div>
                <div class="upcoming-diff">${r.diff}</div>
              </div>`,
              )
              .join("");

            sec.innerHTML = `<div class="upcoming-card">
              <div class="upcoming-hd">Upcoming Payments</div>
              ${rowsHTML}
            </div>`;
          }

export const _upcomingHead = el("coll-head-upcoming");
