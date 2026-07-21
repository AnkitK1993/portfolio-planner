import { EQ_FUNDS, LIQ_FUNDS, defaultRebSections, defaultState, editMode, saveState, setPrivacyMode, setState, state, syncFundArrays } from "../core/state.js";
import { FIREBASE_CONFIG, NW_FIELDS, STORE_KEY } from "../core/constants.js";
import { UI, closeNavDropdowns } from "../core/ui.js";
import { el } from "../core/dom.js";
import { fmt, fmtNum } from "../core/format.js";
import { rebuildFundCollapsibles } from "../features/portfolio/funds.js";
import { render } from "../features/portfolio/render.js";
import { renderReturns, renderTxns } from "../features/transactions/index.js";

export const CACHE_TTL_MS  = 5 * 60 * 1000;

export const SAVE_DEBOUNCE = 2000;

export const MAX_FB_RETRY  = 4;

export let db            = null;

export let fbEnabled     = false;

export let fbAuthReady   = false;

export let authUser      = null;

export let fbSaveTimer   = null;

export let fbDirty       = false;

export let fbRetryDelay  = 2000;

export let fbUnsubscribe = null;

export function fbSyncUI(status, msg) {
            const dot = el("saveDot");
            const txt = el("saveTxt");
            if (!dot || !txt) return;
            if (status === "syncing") {
              dot.className = "dot sync";
              txt.textContent = "Syncing…";
            } else if (status === "ok") {
              dot.className = "dot";
              txt.textContent = "Saved";
              /* Toast for meaningful sync events; skip routine cache-fresh skips */
              if (msg && !msg.startsWith("Cache valid") && !msg.startsWith("Local is current")) {
                UI.toast("info", msg, 3000);
              }
            } else if (status === "err") {
              dot.className = "dot warn";
              txt.textContent = "Offline";
              UI.toast("error", msg || "Cloud sync failed — data saved locally", 6000);
            }
          }

export function initFirebase() {
            if (!FIREBASE_CONFIG.apiKey) return;
            const loadScript = src => new Promise((resolve, reject) => {
              const s = document.createElement("script");
              s.src = src; s.onload = resolve; s.onerror = reject;
              document.head.appendChild(s);
            });
            loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js")
              .then(() => Promise.all([
                loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"),
                loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"),
              ]))
              .then(() => {
                try {
                  firebase.initializeApp(FIREBASE_CONFIG);
                  db = firebase.firestore();
                  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
                  fbEnabled = true;
                  fbAuthReady = true;
                  maybeLoadFromCloud().catch(() => fbSyncUI("err", "Cloud unavailable — using local data"));
                  subscribeToCloud();
                  firebase.auth().onAuthStateChanged(async user => {
                    if (user && user.email !== "ankit.konchady@gmail.com") {
                      await firebase.auth().signOut();
                      UI.toast("err", "Unauthorized — access restricted to admin only", 5000);
                      return;
                    }
                    authUser = user;
                    updateAuthUI();
                    if (user) maybeLoadFromCloud().catch(() => {});
                  });
                  // Completes sign-in started via signInWithRedirect (popup fallback)
                  firebase.auth().getRedirectResult().then(handleSignInResult).catch(e => {
                    if (e && e.code && e.code !== "auth/no-current-user") {
                      UI.toast("err", "Sign-in failed: " + (e.message || e.code), 5000);
                    }
                  });
                } catch (e) {
                  console.warn("Firebase init:", e.message);
                }
              })
              .catch(e => console.warn("Firebase SDK load failed:", e));
          }

export function handleSignInResult(result) {
            if (!result || !result.user) return;
            if (result.user.email !== "ankit.konchady@gmail.com") {
              firebase.auth().signOut();
              UI.toast("err", "Unauthorized — access restricted to admin only", 5000);
            } else {
              const firstName = (result.user.displayName || "Ankit").split(" ")[0];
              UI.toast("success", `Welcome back, ${firstName}! 👋`, 4500);
              setTimeout(() => maybeDailyBackup(), 3000);
            }
          }

export async function loadBackupList() {
            const wrap = el("backupListWrap");
            const list = el("backupList");
            const btn  = el("backupBrowseBtn");
            const open = wrap.style.display === "none";
            wrap.style.display = open ? "block" : "none";
            btn.textContent    = open ? "Hide" : "Browse";
            if (!open) return;

            list.innerHTML = '<div class="backup-list-msg">Loading…</div>';

            if (!fbEnabled || !db || !authUser) {
              list.innerHTML = '<div class="backup-list-msg">Sign in to view cloud backups.</div>';
              return;
            }

            try {
              const snap = await db.collection("dailyBackups").limit(30).get();

              if (snap.empty) {
                list.innerHTML = '<div class="backup-list-msg">No cloud backups found.</div>';
                return;
              }

              list.innerHTML = "";
              const sortedDocs = snap.docs.slice().sort((a, b) => b.id.localeCompare(a.id));
              sortedDocs.forEach(doc => {
                const data = doc.data();
                const t = data.savedAt?.toDate?.();
                const timeStr = t ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                const bytes = (data.state || "").length;
                const sizeStr = bytes > 1024 ? (bytes / 1024).toFixed(1) + " KB" : bytes + " B";

                // Parse backup to extract preview info
                let nwStr = "", fundsStr = "";
                try {
                  const raw = JSON.parse(data.state || "{}");
                  const liqOrder = raw.liquidOrder || Object.keys(raw.liquid || {});
                  const eqOrder  = raw.equityOrder  || Object.keys(raw.equity  || {});
                  const liqVal  = liqOrder.reduce((s, id) => s + (raw.liquid?.[id]?.value  || 0), 0);
                  const eqVal   = eqOrder.reduce((s, id)  => s + (raw.equity?.[id]?.shown  || 0), 0);
                  const otherNW = Object.values(raw.networth || {}).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
                  const totalNW = liqVal + eqVal + otherNW;
                  if (totalNW > 0) nwStr = fmt(Math.round(totalNW));
                  const fundCount = liqOrder.length + eqOrder.length;
                  if (fundCount > 0) fundsStr = fundCount + " fund" + (fundCount !== 1 ? "s" : "");
                } catch (_) {}

                const item = document.createElement("div");
                item.className = "backup-item";
                item.innerHTML = `
                  <div style="flex:1;min-width:0;">
                    <div class="backup-item-date">${doc.id}<span class="backup-item-time">${timeStr ? " · " + timeStr : ""}</span></div>
                    <div style="font-size:10px;color:var(--dim);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap;">
                      ${nwStr ? `<span style="color:var(--mint);font-family:'Roboto Mono',monospace;">${nwStr}</span>` : ""}
                      ${fundsStr ? `<span>${fundsStr}</span>` : ""}
                      <span>${sizeStr}</span>
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button class="btn btn-ghost btn-sm restore-btn">Restore</button>
                    <button class="btn btn-ghost btn-sm delete-btn" style="color:var(--coral)">✕</button>
                  </div>
                `;
                item.querySelector(".restore-btn").addEventListener("click", () => {
                  UI.confirm(
                    `Restore the snapshot from ${doc.id}? This replaces all current data.`,
                    "Restore Backup", "Restore",
                    async () => {
                      try {
                        const docSnap = await db.collection("dailyBackups").doc(doc.id).get();
                        const raw = JSON.parse(docSnap.data().state || "{}");
                        if (!raw.liquid || !raw.equity) { UI.toast("err", "Snapshot data is invalid", 3000); return; }
                        applyCloudState(raw);
                        saveState();
                        el("dataModal").style.display = "none";
                        UI.toast("success", "Restored backup from " + doc.id, 3000);
                      } catch (e) {
                        UI.toast("err", "Failed to restore — " + e.message, 4000);
                      }
                    }, false
                  );
                });
                item.querySelector(".delete-btn").addEventListener("click", () => {
                  UI.confirm(
                    `Delete cloud backup from ${doc.id}? This cannot be undone.`,
                    "Delete Backup", "Delete",
                    async () => {
                      try {
                        await db.collection("dailyBackups").doc(doc.id).delete();
                        item.remove();
                        UI.toast("success", "Backup " + doc.id + " deleted", 2500);
                        if (!el("backupList").children.length)
                          el("backupList").innerHTML = '<div class="backup-list-msg">No cloud backups found.</div>';
                      } catch (e) {
                        UI.toast("err", "Delete failed — " + e.message, 4000);
                      }
                    }, false
                  );
                });
                list.appendChild(item);
              });
            } catch (e) {
              list.innerHTML = `<div class="backup-list-msg">Failed to load backups: ${e.message}</div>`;
              console.warn("loadBackupList:", e);
            }
          }

export function applyCloudState(raw) {
            if (editMode) return;
            const def = defaultState();
            const liqOrder = raw.liquidOrder || ['liq1', 'liq2'];
            const eqOrder = raw.equityOrder || ['eq1', 'eq2', 'eq3'];
            const liqBase = { name: '', label: '', paid: 0, value: 0, reserve: 0, target: 0 };
            const eqBase = { name: '', label: '', paid: 0, shown: 0, target: 0, sipAmt: 0, sipDate: 5, sipPaidAmounts: {} };
            setState({
              liquid: Object.fromEntries(liqOrder.map(id => [id, { ...liqBase, ...(raw.liquid?.[id] || {}) }])),
              equity: Object.fromEntries(eqOrder.map(id => [id, { ...eqBase, ...(raw.equity?.[id] || {}) }])),
              liquidOrder: liqOrder,
              equityOrder: eqOrder,
              stp: { ...def.stp, ...(raw.stp || {}) },
              networth: {
                ...Object.fromEntries(NW_FIELDS.map((f) => [f.id, raw.networth?.[f.id] ?? 0])),
                snapshots: { ...(raw.networth?.snapshots || {}) },
              },
              forecast: { ...def.forecast, ...(raw.forecast || {}) },
              transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
              returnsLog: Array.isArray(raw.returnsLog) ? raw.returnsLog : [],
              calendarNotes: Array.isArray(raw.calendarNotes) ? raw.calendarNotes : [],
              rebalance: { sections: Array.isArray(raw.rebalance?.sections) ? raw.rebalance.sections : defaultRebSections() },
              _meta: { ...def._meta, ...(raw._meta || {}), syncedAt: new Date().toISOString() },
            });
            localStorage.setItem(STORE_KEY, JSON.stringify(state));
            syncFundArrays();
            rebuildFundCollapsibles();
            syncInputsFromState();
            render();
            renderTxns();
            renderReturns();
          }

export async function saveToCloud(retryNum = 0) {
            if (!fbEnabled || !db) return;
            fbSyncUI("syncing");
            try {
              await db.collection("portfolios").doc("main").set({
                state:   JSON.stringify(state),
                v:       state._meta?.v || 0,
                savedAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
              state._meta.syncedAt = new Date().toISOString();
              localStorage.setItem(STORE_KEY, JSON.stringify(state));
              fbDirty      = false;
              fbRetryDelay = 2000;
              fbSyncUI("ok");
            } catch (e) {
              console.warn("Firebase save:", e.message);
              if (retryNum < MAX_FB_RETRY) {
                setTimeout(() => saveToCloud(retryNum + 1), fbRetryDelay);
                fbRetryDelay = Math.min(fbRetryDelay * 2, 30_000);
              } else {
                fbRetryDelay = 2000;
                fbSyncUI("err", "Sync failed after retries — saved locally");
              }
            }
          }

export async function maybeDailyBackup() {
            if (!fbEnabled || !db || !authUser) return;
            const today = new Date().toISOString().slice(0, 10);
            const lastBackup = localStorage.getItem("lastDailyBackup");
            if (lastBackup === today) return;
            try {
              await db.collection("dailyBackups").doc(today).set({
                state:    JSON.stringify(state),
                savedAt:  firebase.firestore.FieldValue.serverTimestamp(),
              });
              localStorage.setItem("lastDailyBackup", today);
              UI.toast("success", "Daily backup saved (" + today + ")", 3000);
            } catch (e) {
              console.warn("Daily backup failed:", e.message);
            }
          }

export async function saveManualBackup() {
            if (!fbEnabled || !db || !authUser) {
              UI.toast("err", "Sign in to back up to cloud", 3000);
              return;
            }
            const btn = el("backupNowBtn");
            btn.disabled = true;
            btn.textContent = "Saving…";
            const today = new Date().toISOString().slice(0, 10);
            try {
              /* Find the first unused key for today: today, today-2, today-3 … */
              let docId = today;
              const baseSnap = await db.collection("dailyBackups").doc(today).get();
              if (baseSnap.exists) {
                let n = 2;
                while (true) {
                  const candidate = today + "-" + n;
                  const snap = await db.collection("dailyBackups").doc(candidate).get();
                  if (!snap.exists) { docId = candidate; break; }
                  n++;
                }
              }
              await db.collection("dailyBackups").doc(docId).set({
                state:   JSON.stringify(state),
                savedAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
              localStorage.setItem("lastDailyBackup", today);
              UI.toast("success", "Cloud backup saved (" + docId + ")", 3000);
            } catch (e) {
              UI.toast("err", "Backup failed — " + e.message, 4000);
            } finally {
              btn.disabled = false;
              btn.textContent = "Back Up Now";
            }
          }

export function scheduleCloudSave() {
            if (!fbEnabled) return;
            fbDirty = true;
            clearTimeout(fbSaveTimer);
            fbSaveTimer = setTimeout(() => saveToCloud(0), SAVE_DEBOUNCE);
          }

/* Bypasses the debounce so a pending save isn't lost if the tab closes
   before the timer fires — called on visibility/unload transitions. */
export function flushCloudSave() {
            if (!fbEnabled || !fbDirty) return;
            clearTimeout(fbSaveTimer);
            saveToCloud(0);
          }

export async function loadFromCloud() {
            if (!fbEnabled || !db) return null;
            try {
              const doc = await db.collection("portfolios").doc("main").get();
              if (doc.exists && doc.data().state)
                return JSON.parse(doc.data().state);
            } catch (e) {
              console.warn("Firebase load:", e.message);
            }
            return null;
          }

export async function maybeLoadFromCloud() {
            if (!fbEnabled || !db) return;
            const meta     = state._meta || {};
            const syncedAt = meta.syncedAt ? new Date(meta.syncedAt).getTime() : 0;
            const isStale  = !syncedAt || (Date.now() - syncedAt > CACHE_TTL_MS);

            if (!isStale) {
              fbSyncUI("ok", "Cache valid — no sync needed");
              return;
            }

            fbSyncUI("syncing");
            const raw = await loadFromCloud();

            if (!raw) {
              fbDirty = true;
              await saveToCloud(0);
              return;
            }

            const localV = meta.v || 0;
            const cloudV = raw._meta?.v || 0;

            if (cloudV > localV) {
              // Another device saved a newer version — apply it
              applyCloudState(raw);
              fbSyncUI("ok", "Synced from cloud ✓");
            } else if (cloudV < localV) {
              // Local is ahead (e.g., edited offline) — push to cloud
              fbDirty = true;
              await saveToCloud(0);
            } else {
              // Same version — but if local has no real data, apply cloud state anyway
              // (covers fresh device where both localV and cloudV are 0)
              const hasLocalData = !!localStorage.getItem(STORE_KEY);
              if (!hasLocalData && raw) {
                applyCloudState(raw);
                fbSyncUI("ok", "Synced from cloud ✓");
              } else {
                state._meta.syncedAt = new Date().toISOString();
                localStorage.setItem(STORE_KEY, JSON.stringify(state));
                fbSyncUI("ok");
              }
            }
          }

export function subscribeToCloud() {
            if (!fbEnabled || !db) return;
            fbUnsubscribe = db.collection("portfolios").doc("main").onSnapshot(
              (doc) => {
                // hasPendingWrites = true means this is our own optimistic write — skip
                if (!doc.exists || doc.metadata.hasPendingWrites) return;
                try {
                  const raw    = JSON.parse(doc.data().state || "{}");
                  const localV = state._meta?.v || 0;
                  const cloudV = raw._meta?.v   || 0;
                  if (cloudV > localV) {
                    applyCloudState(raw);
                    fbSyncUI("ok", "Updated from another device ✓");
                  }
                } catch (e) {
                  console.warn("Firestore snapshot:", e.message);
                }
              },
              (err) => console.warn("Firestore listener:", err.message),
            );
          }

export function syncInputsFromState() {
            LIQ_FUNDS.forEach((f) => {
              const s = state.liquid[f.id];
              el("lname-" + f.id).value = s.name || "";
              el("lpaid-" + f.id).value = fmtNum(s.paid);
              el("lval-" + f.id).value = fmtNum(s.value);
              el("lres-" + f.id).value = fmtNum(s.reserve);
              el("ltgt-" + f.id).value = fmtNum(s.target);
              const hdr = el("coll-name-" + f.id);
              if (hdr) hdr.value = s.label || f.defaultName;
            });
            EQ_FUNDS.forEach((f) => {
              const s = state.equity[f.id];
              el("ename-" + f.id).value = s.name || "";
              el("epaid-" + f.id).value = fmtNum(s.paid);
              el("eshown-" + f.id).value = fmtNum(s.shown);
              el("etgt-" + f.id).value = fmtNum(s.target);
              el("esip-" + f.id).value = fmtNum(s.sipAmt);
              el("esipdate-" + f.id).value = s.sipDate || "";
              const hdr = el("coll-name-" + f.id);
              if (hdr) hdr.value = s.label || f.defaultName;
            });
            NW_FIELDS.forEach((f) => {
              const inp = el("nw-" + f.id);
              if (inp) inp.value = fmtNum(state.networth[f.id]);
            });
          }

export function resetBackupPanel() {
            el("backupListWrap").style.display = "none";
            el("backupBrowseBtn").textContent = "Browse";
          }

export function updateAuthUI() {
            const userInfo = el("ddUserInfo");
            const authBtn  = el("ddAuthBtn");
            const isGuest  = !authUser;

            // Admin-only items — hide for guests
            ["editToggleBtn", "ddDataBtn", "txnsBtn"].forEach(id => {
              const el2 = el(id); if (el2) el2.style.display = isGuest ? "none" : "";
            });

            // Force privacy mode on for guests; cannot be toggled
            if (isGuest) {
              setPrivacyMode(true);
              document.body.classList.add("privacy-mode");
            }

            if (authUser) {
              setPrivacyMode(false);
              document.body.classList.remove("privacy-mode");
              closeNavDropdowns();
              el("ddUserName").textContent = authUser.displayName || authUser.email || "Signed in";
              const avatar = el("ddUserAvatar");
              avatar.src = authUser.photoURL || "";
              avatar.style.display = authUser.photoURL ? "block" : "none";
              userInfo.style.display = "flex";
              authBtn.innerHTML = "Sign out";
            } else {
              userInfo.style.display = "none";
              authBtn.innerHTML = `<svg viewBox="0 0 18 18" width="15" height="15" style="flex-shrink:0"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg> Sign in with Google`;
            }
          }

export const _hasLocalData = !!localStorage.getItem(STORE_KEY);
