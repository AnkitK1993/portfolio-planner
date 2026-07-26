import { EQ_FUNDS, snapshotKey, state } from "../core/state.js";
import { fmt, fmtMonth } from "../core/format.js";
import { UI } from "../core/ui.js";

const PREF_KEY  = "remindersEnabled";
const SHOWN_KEY = "remindersShown";

// Tab-open only, on purpose — no service worker / FCM. Checks run on an
// interval while this tab is alive, same as everything else in this
// app; nothing fires once the tab is closed.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let timer = null;

export function remindersEnabled() {
            return localStorage.getItem(PREF_KEY) === "1"
              && typeof Notification !== "undefined"
              && Notification.permission === "granted";
          }

export function reminderBtnLabel() {
            return remindersEnabled() ? "Disable Reminders" : "Enable Reminders";
          }

function shownSet() {
            try { return JSON.parse(localStorage.getItem(SHOWN_KEY) || "{}"); } catch (_) { return {}; }
          }

function markShown(key) {
            const s = shownSet();
            s[key] = true;
            const keys = Object.keys(s);
            if (keys.length > 200) keys.slice(0, keys.length - 200).forEach(k => delete s[k]);
            localStorage.setItem(SHOWN_KEY, JSON.stringify(s));
          }

function notify(title, body, tag) {
            const note = new Notification(title, { body, tag });
            note.onclick = () => { window.focus(); note.close(); };
          }

// Mirrors renderUpcoming()'s SIP-due-date logic (features/portfolio/
// upcoming.js) — same fields, same funds — just fires a real
// notification instead of a dashboard row, once per fund per month.
function checkReminders() {
            if (!remindersEnabled()) return;
            const today = new Date();
            const d = today.getDate();
            const monthKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
            const seen = shownSet();

            EQ_FUNDS.forEach(f => {
              const s = state.equity[f.id];
              const sipAmt = s.sipAmt || 0, sipDate = s.sipDate || 0;
              if (sipAmt > 0 && sipDate === d) {
                const key = monthKey + "-sip-" + f.id;
                if (!seen[key]) {
                  markShown(key);
                  notify("SIP due today", (s.name || f.defaultName) + " — " + fmt(sipAmt), key);
                }
              }
            });

            // snapshotKey() is always *last* calendar month (see core/state.js)
            // — a snapshot for it can be saved any time during the current
            // month, so nudge once/month starting a few days in rather than
            // tying it to a specific due date.
            if (d >= 3) {
              const key = monthKey + "-snapshot";
              const snapKey = snapshotKey();
              const hasSnap = !!(state.networth.snapshots && state.networth.snapshots[snapKey]);
              if (!hasSnap && !seen[key]) {
                markShown(key);
                notify("Net worth snapshot pending", "You haven't saved a snapshot for " + fmtMonth(snapKey) + " yet.", key);
              }
            }
          }

function startReminders() {
            if (timer) return;
            checkReminders();
            timer = setInterval(checkReminders, CHECK_INTERVAL_MS);
          }

function stopReminders() {
            clearInterval(timer);
            timer = null;
          }

export function initReminders() {
            if (remindersEnabled()) startReminders();
          }

export async function toggleReminders() {
            if (localStorage.getItem(PREF_KEY) === "1") {
              localStorage.setItem(PREF_KEY, "0");
              stopReminders();
              UI.toast("info", "Reminders turned off", 2500);
              return;
            }
            if (typeof Notification === "undefined") {
              UI.toast("err", "Notifications aren't supported in this browser", 3500);
              return;
            }
            let perm = Notification.permission;
            if (perm === "default") perm = await Notification.requestPermission();
            if (perm !== "granted") {
              UI.toast("err", "Notification permission was denied", 3500);
              return;
            }
            localStorage.setItem(PREF_KEY, "1");
            UI.toast("success", "Reminders on — SIP due dates and month-end snapshot nudges will show while this tab is open", 4500);
            startReminders();
          }
