import { NW_FIELDS, OTHER_FIELDS } from "../../core/constants.js";
import { UI } from "../../core/ui.js";
import { open as openModal } from "../../core/modal.js";
import { _animOnRender, animateNumber, animateWidth } from "../../core/animate.js";
import { avgMonthlyGrowthRate, buildCurrentSnapshot, extraIncome, mfTotalValue, mfUnrealizedGain, mfValueAsOf, nwTotal } from "../../domain/networth.js";
import { editMode, EQ_FUNDS, LIQ_FUNDS, normalizeSnap, othersOfSnap, saveState, snapshotKey, state } from "../../core/state.js";
import { el } from "../../core/dom.js";
import { fmt, fmtCompact, fmtMonth, fmtNum, num } from "../../core/format.js";
import { deleteSnapshot, healSnapshotMf, saveSnapshot, setNetworthField } from "../../store/actions.js";

export let nwHistExpanded = new Set();

export let nwHistCompare  = new Set();

export let snapListExpanded = new Set();

// Shared by renderNwHistory() (Net Worth tab) and renderSnapshotsList()
// (Transactions tab) — both list the same underlying snapshots, just
// with a different level of detail, so the field shape stays in sync.
const SNAPSHOT_DETAIL_FIELDS = [
            { key: "mf",       label: "MF Value" },
            { key: "mfProfit", label: "Unrealized Gain" },
            ...OTHER_FIELDS.map(f => ({ key: f.id, label: f.label })),
            { key: "income",   label: "Income" },
            { key: "total",    label: "Total" },
          ];

// Shows the raw Income figure everywhere it's listed, with a note when
// it's excluded from the total (already folded into Bank & Savings) —
// showing only the derived incomeExtra (0 when "in Bank") looked like
// the entered Income had vanished/reset, even though it was saved fine.
function fmtIncomeCell(s) {
            const val = fmtCompact(s.income || 0);
            return s.incomeInBank ? `${val} <span style="color:var(--dim)">(in Bank)</span>` : val;
          }

export function buildNwGrid() {
            el("nwFieldsGrid").innerHTML = NW_FIELDS.map(
              (f) => `
              <div class="field" style="margin-bottom:0;">
                <label class="flabel" for="nw-${f.id}">${f.label}${f.id === "mfProfit" ? ' <span style="color:var(--dim);font-size:8px;text-transform:none;letter-spacing:0;">(auto-calculated)</span>' : ""}</label>
                <div class="ibox"><span class="pfx">&#8377;</span>
                  <input class="num" id="nw-${f.id}" type="text" placeholder="0"
                    inputmode="numeric" value="${fmtNum(state.networth[f.id])}"
                    ${f.id === "mfProfit" ? "readonly style=\"opacity:0.6;cursor:default;\"" : ""} />
                </div>
              </div>`,
            ).join("");

            NW_FIELDS.forEach((f) => {
              if (f.id === "mfProfit") return;
              const inp = el("nw-" + f.id);
              if (!inp) return;
              inp.addEventListener("input", (e) => {
                setNetworthField(f.id, num(e.target.value));
                renderNetWorth();
              });
              inp.addEventListener("focus", () => { const v = num(inp.value); inp.value = v > 0 ? v : ""; });
              inp.addEventListener("blur",  () => { inp.value = fmtNum(num(inp.value)); });
            });

            // Income — not part of NW_FIELDS (see extraIncome() in
            // domain/networth.js for why: it needs the "already in Bank"
            // flag's conditional logic, not a flat unconditional sum).
            // Not auto-reset month to month, same as every other field
            // here — whatever was last entered IS the default for the next
            // month, until the user changes it.
            const incomeInp = el("nw-income");
            if (incomeInp) {
              incomeInp.value = fmtNum(state.networth.income);
              incomeInp.addEventListener("input", (e) => {
                setNetworthField("income", num(e.target.value));
                renderNetWorth();
              });
              incomeInp.addEventListener("focus", () => { const v = num(incomeInp.value); incomeInp.value = v > 0 ? v : ""; });
              incomeInp.addEventListener("blur",  () => { incomeInp.value = fmtNum(num(incomeInp.value)); });
            }
            const incomeFlag = el("nw-income-in-bank");
            if (incomeFlag) {
              incomeFlag.checked = !!state.networth.incomeInBank;
              incomeFlag.addEventListener("change", (e) => {
                setNetworthField("incomeInBank", e.target.checked);
                renderNetWorth();
              });
            }
          }

export function renderNetWorth() {
            const mfVal = mfTotalValue(LIQ_FUNDS, EQ_FUNDS, state.liquid, state.equity);
            const profit = mfUnrealizedGain(LIQ_FUNDS, EQ_FUNDS, state.liquid, state.equity);
            setNetworthField("mfProfit", profit);
            const inp = el("nw-mfProfit");
            if (inp) inp.value = profit !== 0 ? Math.round(profit).toLocaleString("en-IN") : "";
            const other = NW_FIELDS.filter((f) => f.id !== "mfProfit").reduce(
              (s, f) => s + (state.networth[f.id] || 0), 0,
            );
            const incomeExtra = extraIncome(state.networth);
            const total = mfVal + profit + other + incomeExtra;
            const breakdownPreview = el("nwBreakdownPreview");
            if (breakdownPreview) breakdownPreview.textContent = fmt(total);

            el("nwMfVal").textContent = fmt(mfVal);
            animateNumber(el("nwHeroVal"), total, _animOnRender && !editMode ? 2000 : 500, _animOnRender && !editMode);
            const _snapKey = snapshotKey();
            const _hasSnap = !!(state.networth.snapshots && state.networth.snapshots[_snapKey]);
            const _snapBtn = el("nwSnapshotBtn");
            _snapBtn.textContent = "Save snapshot — " + fmtMonth(_snapKey);
            _snapBtn.style.display = _hasSnap ? "none" : "";

            // Delta chips, stats row, sparkline — driven by snapshots
            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps)
              .map(([k, v]) => normalizeSnap(k, v))
              .sort((a, b) => a.key.localeCompare(b.key));
            const deltaRow = el("nwDeltaChips");
            const statRow  = el("nwStatRow");

            if (sorted.length >= 1) {
              const last = sorted[sorted.length - 1];
              // MoM: diff between live total and most recent snapshot
              const momChip = el("nwMomChip");
              if (momChip) {
                const mom = total - last.total;
                const sign = mom >= 0 ? "▲" : "▼";
                momChip.textContent = `${sign} ${mom >= 0 ? "+" : "−"}${fmt(Math.abs(mom))} MoM`;
                momChip.className = "nw-delta-chip" + (mom < 0 ? " neg" : "");
              }
              if (deltaRow) deltaRow.style.display = "flex";

              // Avg monthly growth
              if (statRow) {
                let sumDelta = 0, countDelta = 0;
                for (let i = 1; i < sorted.length; i++) { sumDelta += sorted[i].total - sorted[i-1].total; countDelta++; }
                sumDelta += total - last.total; countDelta++;
                const avg = countDelta > 0 ? sumDelta / countDelta : 0;
                const avgEl = el("nwAvgGrowth");
                if (avgEl) {
                  avgEl.textContent = (avg >= 0 ? "+" : "−") + fmt(Math.abs(avg));
                  avgEl.style.color = avg >= 0 ? "var(--mint)" : "var(--coral)";
                }
                statRow.style.display = "grid";
              }
            } else {
              if (deltaRow) deltaRow.style.display = "none";
              if (statRow)  statRow.style.display  = "none";
            }

            // Hero sparkline — last 6 snapshots + live total
            const sparkEl = el("nwHeroSparkline");
            if (sparkEl) {
              const pts = [...sorted.slice(-6).map(s => s.total), total];
              if (pts.length >= 2) {
                const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
                const W = 110, H = 52, P = 4;
                const px = i => (i / (pts.length - 1)) * (W - P * 2) + P;
                const py = v => H - P - ((v - mn) / rng) * (H - P * 2);
                const ld = pts.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
                const ad = ld + ` L${px(pts.length-1).toFixed(1)},${H} L${P},${H} Z`;
                const lx = px(pts.length-1).toFixed(1), ly = py(total).toFixed(1);
                sparkEl.innerHTML = `<defs><linearGradient id="spkG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3dd68c" stop-opacity="0.3"/><stop offset="100%" stop-color="#3dd68c" stop-opacity="0"/></linearGradient></defs>
                  <path d="${ad}" fill="url(#spkG)"/>
                  <path d="${ld}" fill="none" stroke="#3dd68c" stroke-width="2" stroke-linejoin="round"/>
                  <circle cx="${lx}" cy="${ly}" r="3.5" fill="#3dd68c"/>`;
              } else { sparkEl.innerHTML = ""; }
            }

            // Asset breakdown bars
            const cats = [
              { label: "Mutual Funds", value: mfVal, color: "#4ade9c" },
              { label: "Unrealized Gain", value: profit > 0 ? profit : 0, color: "#86efac" },
              { label: "Bank & Savings", value: state.networth.bank || 0, color: "var(--liq)" },
              { label: "Fixed Deposit", value: state.networth.fd || 0, color: "#5bc4f5" },
              { label: "Cash", value: state.networth.cash || 0, color: "var(--amber)" },
              { label: "PPF", value: state.networth.ppf || 0, color: "#8be8ff" },
              { label: "EPF", value: state.networth.epf || 0, color: "#2dd4bf" },
              { label: "Bonds", value: state.networth.bonds || 0, color: "#c084fc" },
              // Only shows up when it's actually adding to the total (i.e.
              // not already folded into Bank & Savings) — see extraIncome().
              { label: "Income (not in Bank)", value: incomeExtra, color: "#fbbf24" },
            ].filter((c) => c.value > 0);

            if (!cats.length) {
              el("nwBreakdown").innerHTML = `<div style="color:var(--dim);font-size:12px;">Enter values above to see the breakdown.</div>`;
              return;
            }
            const maxW = Math.max(...cats.map((c) => c.value));
            el("nwBreakdown").innerHTML = cats.map((c) => {
              const barW = Math.max(1, Math.round((c.value / maxW) * 100));
              const share = total > 0 ? Math.round((c.value / total) * 100) : 0;
              return `<div class="nw-bar-row">
                <div class="nw-bar-label" title="${c.label}">${c.label}</div>
                <div class="nw-bar-track"><div class="nw-bar-fill" data-w="${barW}" style="width:0%;background:${c.color};"></div></div>
                <div class="nw-bar-val">${fmt(c.value)}<span class="nw-bar-pct">${share}%</span></div>
              </div>`;
            }).join("");
            el("nwBreakdown").querySelectorAll(".nw-bar-fill").forEach(bar => {
              const tw = parseFloat(bar.dataset.w) || 0;
              if (_animOnRender && !editMode) animateWidth(bar, tw, 1200);
              else bar.style.width = tw + "%";
            });
          }

export function takeSnapshot() {
            const key = snapshotKey();
            const mfVal = mfValueAsOf(key, LIQ_FUNDS, EQ_FUNDS, state.transactions);
            const other = NW_FIELDS.filter((f) => f.id !== "mfProfit").reduce(
              (s, f) => s + (state.networth[f.id] || 0), 0
            );
            const incomeExtra = extraIncome(state.networth);
            const total = mfVal + (state.networth.mfProfit || 0) + other + incomeExtra;
            const doSave = () => {
              const snap = {
                mf: mfVal, total, incomeExtra,
                income: state.networth.income || 0,
                incomeInBank: !!state.networth.incomeInBank,
                savedAt: new Date().toISOString(),
              };
              NW_FIELDS.forEach((f) => { snap[f.id] = state.networth[f.id] || 0; });
              saveSnapshot(key, snap);
              saveState();
              refreshAllSnapshotViews();
              const msg = el("nwSnapMsg");
              if (msg) {
                msg.textContent = "Saved ✓ " + fmtMonth(key);
                setTimeout(() => { if (msg.textContent.startsWith("Saved")) msg.textContent = ""; }, 3000);
              }
            };
            if (state.networth.snapshots[key]) {
              UI.confirm("Replace the existing snapshot for " + fmtMonth(key) + "?", "Overwrite snapshot?", "Overwrite", doSave);
            } else {
              doSave();
            }
          }

export function renderNwHistory() {
            const snaps = state.networth.snapshots || {};
            // Self-heal: recompute each snapshot's MF Value from transaction
            // history as of its month, correcting any figure that was
            // previously saved wrong (e.g. overwritten with a live total).
            let healed = false;
            Object.keys(snaps).forEach((k) => {
              const correctMf = mfValueAsOf(k, LIQ_FUNDS, EQ_FUNDS, state.transactions);
              if ((snaps[k].mf || 0) !== correctMf) {
                healSnapshotMf(k, correctMf);
                healed = true;
              }
            });
            if (healed) saveState();
            const sorted = Object.entries(snaps)
              .map(([k, v]) => normalizeSnap(k, v))
              .sort((a, b) => b.key.localeCompare(a.key));

            const histPreview = el("nwHistPreview");
            if (histPreview) histPreview.textContent = sorted.length ? fmt(sorted[0].total) : "";

            if (!sorted.length) {
              el("nwHistory").innerHTML =
                `<div style="color:var(--dim);font-size:12px;">No snapshots yet. Fill in values above and click "Save snapshot".</div>`;
              return;
            }

            const DETAIL_FIELDS = SNAPSHOT_DETAIL_FIELDS;

            const colTpl = editMode
              ? "1.5fr 1fr 1fr 1fr 1.2fr 1fr 20px"
              : "1.5fr 1fr 1fr 1fr 1.2fr 1fr";

            const rows = sorted.map((s, i) => {
              const prev = sorted[i + 1];
              const delta = prev !== undefined ? s.total - prev.total : null;
              const dStr = delta !== null
                ? `<span style="color:${delta >= 0 ? "var(--mint)" : "var(--coral)"};font-weight:600;">${delta >= 0 ? "+" : ""}${fmtCompact(delta)}</span>`
                : "—";
              const isOpen = nwHistExpanded.has(s.key);

              let expandHtml = "";
              if (isOpen) {
                const showCompare = nwHistCompare.has(s.key);
                const cur = showCompare ? buildCurrentSnapshot(state.networth, LIQ_FUNDS, EQ_FUNDS, state.liquid, state.equity) : null;
                expandHtml = (showCompare
                  ? `<div class="nw-hist-cmp-head"><span>Field</span><span>${fmtMonth(s.key)}</span><span>Current</span><span>&Delta;</span></div>` +
                    DETAIL_FIELDS.map(f => {
                      const snapV = s[f.key] || 0, curV = cur[f.key] || 0, d = curV - snapV;
                      const dColor = d > 0 ? "var(--mint)" : d < 0 ? "var(--coral)" : "var(--dim)";
                      const snapCell = f.key === "income" ? fmtIncomeCell(s) : fmtCompact(snapV);
                      const curCell = f.key === "income" ? fmtIncomeCell(cur) : fmtCompact(curV);
                      return `<div class="nw-hist-cmp-row">
                        <span class="nw-hist-cmp-label">${f.label}</span>
                        <span class="nw-hist-cmp-val">${snapCell}</span>
                        <span class="nw-hist-cmp-val">${curCell}</span>
                        <span class="nw-hist-cmp-delta" style="color:${dColor}">${d === 0 ? "—" : (d > 0 ? "+" : "") + fmtCompact(d)}</span>
                      </div>`;
                    }).join("")
                  : DETAIL_FIELDS.map(f =>
                      `<div class="nw-hist-detail-row"><span>${f.label}</span><span>${f.key === "income" ? fmtIncomeCell(s) : fmtCompact(s[f.key] || 0)}</span></div>`
                    ).join("")
                ) + `<button class="nw-hist-cmp-btn" data-key="${s.key}">${showCompare ? "Hide comparison" : "Compare with Current"}</button>`;
              }

              return `<div class="nw-hist-item">
                <div class="nw-hist-main" data-key="${s.key}" style="grid-template-columns:${colTpl}">
                  <span style="color:var(--dim)">${isOpen ? "▾" : "▸"} ${fmtMonth(s.key)}</span>
                  <span>${fmtCompact(s.mf || 0)}</span>
                  <span>${fmtCompact(s.mfProfit || 0)}</span>
                  <span>${fmtCompact(othersOfSnap(s))}</span>
                  <span style="color:var(--mint);font-weight:600;">${fmtCompact(s.total)}</span>
                  <span>${dStr}</span>
                  ${editMode ? `<span><button class="nw-hist-del" data-key="${s.key}" title="Delete" style="background:none;border:none;cursor:pointer;color:var(--dim);font-size:11px;padding:2px;line-height:1;">✕</button></span>` : ""}
                </div>
                ${isOpen ? `<div class="nw-hist-expand">${expandHtml}</div>` : ""}
              </div>`;
            }).join("");

            el("nwHistory").innerHTML = `<div class="nw-hist-list">
              <div class="nw-hist-hdr" style="grid-template-columns:${colTpl}">
                <span>Month</span><span>MF</span><span>Returns</span><span>Others</span>
                <span style="color:var(--mint)">Total</span><span>&Delta;</span>
                ${editMode ? "<span></span>" : ""}
              </div>
              ${rows}
            </div>`;

            el("nwHistory").querySelectorAll(".nw-hist-main").forEach(row => {
              row.addEventListener("click", () => {
                const key = row.dataset.key;
                if (nwHistExpanded.has(key)) nwHistExpanded.delete(key);
                else nwHistExpanded.add(key);
                renderNwHistory();
              });
            });

            el("nwHistory").querySelectorAll(".nw-hist-cmp-btn").forEach(btn => {
              btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const key = btn.dataset.key;
                if (nwHistCompare.has(key)) nwHistCompare.delete(key);
                else nwHistCompare.add(key);
                renderNwHistory();
              });
            });

            el("nwHistory").querySelectorAll(".nw-hist-del").forEach(btn => {
              btn.addEventListener("click", (e) => { e.stopPropagation(); deleteSnapshotWithUndo(btn.dataset.key); });
            });
          }

// Shared by every place a snapshot can be deleted (Net Worth tab's
// Monthly History list and the Transactions tab's Snapshots list) so
// there's one undo-toast implementation instead of two copies that could
// drift — deleting from either list refreshes both.
function refreshAllSnapshotViews() {
            renderNetWorth();
            renderNwHistory();
            renderSnapshotsList();
            renderNwLineChart();
            renderNwCompositionChart();
            renderNwProjection();
          }

function deleteSnapshotWithUndo(key) {
            const snap = state.networth.snapshots && state.networth.snapshots[key];
            if (!snap) return;
            deleteSnapshot(key);
            nwHistExpanded.delete(key);
            nwHistCompare.delete(key);
            snapListExpanded.delete(key);
            saveState();
            refreshAllSnapshotViews();
            UI.undoToast("Snapshot for " + fmtMonth(key) + " deleted", () => {
              saveSnapshot(key, snap);
              saveState();
              refreshAllSnapshotViews();
            });
          }

// Edits an arbitrary month's snapshot entirely within its own popup —
// Update Assets only ever reflects live/current values, never a past
// snapshot, so this reads/writes the snapshot object directly instead
// of routing through state.networth. MF Value and Unrealized Gain are
// derived/frozen (never hand-entered, same as in Update Assets, where
// mfProfit is readonly), so they're shown read-only here too. Income and
// its "already in Bank" flag ARE historized per snapshot (frozen at
// takeSnapshot() time, same as Bank/FD/etc.) and editable here — snaps
// saved before that field existed only have the derived incomeExtra, so
// those default income to incomeExtra (and the flag to off), which
// reproduces the same incomeExtra via extraIncome() if left untouched.
export function editSnapshot(key) {
            const snap = state.networth.snapshots && state.networth.snapshots[key];
            if (!snap) return;
            const fid = (id) => "snapEdit-" + id;
            const normalized = normalizeSnap(key, snap);
            const incomeVal = normalized.income;
            const incomeInBank = normalized.incomeInBank;
            const readonlyRows = [
              { label: "MF Value", value: snap.mf || 0 },
              { label: "Unrealized Gain", value: snap.mfProfit || 0 },
            ];
            let bodyElRef = null;

            openModal({
              title: "Edit " + fmtMonth(key),
              size: "sm",
              body: (bodyEl) => {
                bodyElRef = bodyEl;
                bodyEl.innerHTML = `
                  <div>
                    ${readonlyRows.map(r => `<div class="nw-hist-detail-row"><span>${r.label}</span><span>${fmt(r.value)}</span></div>`).join("")}
                  </div>
                  <div style="border-top:1px solid var(--line);"></div>
                  ${OTHER_FIELDS.map(f => `
                    <div class="field" style="margin-bottom:0;">
                      <label class="flabel" for="${fid(f.id)}">${f.label}</label>
                      <input class="form-inp" id="${fid(f.id)}" type="text" inputmode="numeric" value="${fmtNum(snap[f.id])}" />
                    </div>
                  `).join("")}
                  <div style="border-top:1px solid var(--line);"></div>
                  <div class="field" style="margin-bottom:0;">
                    <label class="flabel" for="${fid("income")}">Income</label>
                    <input class="form-inp" id="${fid("income")}" type="text" inputmode="numeric" value="${fmtNum(incomeVal)}" />
                  </div>
                  <label style="display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--dim);cursor:pointer;">
                    <input type="checkbox" id="${fid("incomeInBank")}" ${incomeInBank ? "checked" : ""} />
                    Already included in Bank &amp; Savings (don't add separately to Net Worth)
                  </label>
                `;
                OTHER_FIELDS.forEach(f => {
                  const inp = bodyEl.querySelector("#" + fid(f.id));
                  inp.addEventListener("focus", () => { const v = num(inp.value); inp.value = v > 0 ? v : ""; });
                  inp.addEventListener("blur", () => { inp.value = fmtNum(num(inp.value)); });
                });
                const incomeInp = bodyEl.querySelector("#" + fid("income"));
                incomeInp.addEventListener("focus", () => { const v = num(incomeInp.value); incomeInp.value = v > 0 ? v : ""; });
                incomeInp.addEventListener("blur", () => { incomeInp.value = fmtNum(num(incomeInp.value)); });
              },
              footer: [
                { label: "Cancel", variant: "ghost" },
                {
                  label: "Save",
                  variant: "primary",
                  onClick: () => {
                    const updated = { ...snap };
                    OTHER_FIELDS.forEach(f => { updated[f.id] = num(bodyElRef.querySelector("#" + fid(f.id)).value); });
                    updated.income = num(bodyElRef.querySelector("#" + fid("income")).value);
                    updated.incomeInBank = bodyElRef.querySelector("#" + fid("incomeInBank")).checked;
                    updated.incomeExtra = extraIncome(updated);
                    updated.total = (updated.mf || 0) + (updated.mfProfit || 0) + othersOfSnap(updated) + (updated.incomeExtra || 0);
                    saveSnapshot(key, updated);
                    saveState();
                    refreshAllSnapshotViews();
                    UI.toast("success", "Snapshot updated — " + fmtMonth(key), 2500);
                  },
                },
              ],
            });
          }

// Transactions tab's Snapshots card — a lighter-weight list than Monthly
// History (Month + Total only, no MF/Returns/Others columns or compare
// mode), expanding to a plain field breakdown with Edit/Delete at the
// end. Shows the same snapshots as renderNwHistory(), just presented
// for a "manage my snapshots" flow rather than "browse my history".
export function renderSnapshotsList() {
            const listEl = el("nwSnapshotsList");
            if (!listEl) return;
            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps)
              .map(([k, v]) => normalizeSnap(k, v))
              .sort((a, b) => b.key.localeCompare(a.key));

            if (!sorted.length) {
              listEl.innerHTML = `<div class="exp-empty">No snapshots saved yet.</div>`;
              return;
            }

            listEl.innerHTML = sorted.map(s => {
              const isOpen = snapListExpanded.has(s.key);
              const detailHtml = isOpen
                ? SNAPSHOT_DETAIL_FIELDS.map(f =>
                    `<div class="nw-hist-detail-row"><span>${f.label}</span><span>${f.key === "income" ? fmtIncomeCell(s) : fmtCompact(s[f.key] || 0)}</span></div>`
                  ).join("") +
                  `<div class="nw-snap-edit-row">
                    <button class="btn btn-ghost btn-sm nw-snap-list-edit" data-key="${s.key}">Edit</button>
                    ${editMode ? `<button class="btn btn-ghost btn-sm nw-snap-list-del" data-key="${s.key}" style="color:var(--coral)">Delete</button>` : ""}
                  </div>`
                : "";
              return `<div class="nw-hist-item">
                <div class="nw-hist-main nw-snap-list-main" data-key="${s.key}">
                  <span style="color:var(--dim)">${isOpen ? "▾" : "▸"} ${fmtMonth(s.key)}</span>
                  <span style="color:var(--mint);font-weight:600;">${fmt(s.total)}</span>
                </div>
                ${isOpen ? `<div class="nw-hist-expand">${detailHtml}</div>` : ""}
              </div>`;
            }).join("");

            listEl.querySelectorAll(".nw-snap-list-main").forEach(row => {
              row.addEventListener("click", () => {
                const key = row.dataset.key;
                if (snapListExpanded.has(key)) snapListExpanded.delete(key);
                else snapListExpanded.add(key);
                renderSnapshotsList();
              });
            });
            listEl.querySelectorAll(".nw-snap-list-edit").forEach(btn => {
              btn.addEventListener("click", e => { e.stopPropagation(); editSnapshot(btn.dataset.key); });
            });
            listEl.querySelectorAll(".nw-snap-list-del").forEach(btn => {
              btn.addEventListener("click", e => { e.stopPropagation(); deleteSnapshotWithUndo(btn.dataset.key); });
            });
          }

export function renderNwLineChart() {
            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps)
              .map(([k, v]) => normalizeSnap(k, v))
              .sort((a, b) => a.key.localeCompare(b.key));

            const card = el("nwChartCard");
            if (!card) return;
            if (sorted.length < 2) { card.style.display = "none"; return; }
            card.style.display = "";

            const svg = el("nwLineChart");
            const W = 600, H = 150, PAD_T = 14, PAD_B = 24, PAD_L = 48, PAD_R = 8;
            const n = sorted.length;

            // Avg monthly rate for projection
            let sumRate = 0, rateCount = 0;
            for (let i = 1; i < n; i++) {
              const prev = sorted[i-1], curr = sorted[i];
              if (prev.total > 0) {
                const [py, pm] = prev.key.split("-").map(Number);
                const [cy, cm] = curr.key.split("-").map(Number);
                const months = (cy - py) * 12 + (cm - pm);
                if (months > 0) { sumRate += Math.pow(curr.total / prev.total, 1 / months) - 1; rateCount++; }
              }
            }
            const r = rateCount > 0 ? sumRate / rateCount : 0;
            const lastTotal = sorted[n - 1].total;
            const proj1 = lastTotal * (1 + r), proj2 = proj1 * (1 + r);
            const chartPreview = el("nwChartPreview");
            if (chartPreview) {
              const ann = (Math.pow(1 + r, 12) - 1) * 100;
              chartPreview.textContent = "CAGR " + (ann >= 0 ? "+" : "") + ann.toFixed(1) + "%";
            }

            const vals = sorted.map(s => s.total || 0);
            const minV = Math.min(...vals);
            const maxV = Math.max(Math.max(...vals), proj2);
            const range = maxV - minV || 1;

            // Use n+2 slots (n actual + 2 projected)
            const toX = i => PAD_L + (i / (n + 1)) * (W - PAD_L - PAD_R);
            const toY = v => PAD_T + (1 - (v - minV) / range) * (H - PAD_T - PAD_B);

            // Actual line + area
            const lineStr = sorted.map((s, i) => `${toX(i).toFixed(1)},${toY(s.total).toFixed(1)}`).join(" ");
            const areaPath = `M${toX(0).toFixed(1)},${H - PAD_B} ` +
              sorted.map((s, i) => `L${toX(i).toFixed(1)},${toY(s.total).toFixed(1)}`).join(" ") +
              ` L${toX(n-1).toFixed(1)},${H - PAD_B} Z`;

            // Projection
            const lx = toX(n-1).toFixed(1), ly = toY(lastTotal).toFixed(1);
            const px1 = toX(n).toFixed(1), py1 = toY(proj1).toFixed(1);
            const px2 = toX(n+1).toFixed(1), py2 = toY(proj2).toFixed(1);
            const projArea = `M${lx},${H - PAD_B} L${lx},${ly} L${px1},${py1} L${px2},${py2} L${px2},${H - PAD_B} Z`;

            // Y-axis gridlines
            const gridLines = Array.from({ length: 4 }, (_, i) => {
              const v = minV + range * (i + 1) / 5;
              const y = toY(v).toFixed(1);
              const lbl = v >= 10000000 ? (v/10000000).toFixed(1)+"Cr" : v >= 100000 ? (v/100000).toFixed(1)+"L" : (v/1000).toFixed(0)+"K";
              return `<line x1="${PAD_L}" y1="${y}" x2="${W}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
                <text x="${PAD_L - 4}" y="${parseFloat(y) + 3}" text-anchor="end" font-size="8" fill="var(--dim)" font-family="Roboto Mono,monospace">${lbl}</text>`;
            }).join("");

            // Milestone lines
            const MILESTONES = [100000,250000,500000,1000000,2500000,5000000,10000000,25000000,50000000,100000000];
            const milestoneLines = MILESTONES.filter(m => m > minV && m <= maxV).map(m => {
              const y = toY(m).toFixed(1);
              const lbl = m >= 10000000 ? "₹"+(m/10000000).toFixed(0)+"Cr" : "₹"+(m/100000)+"L";
              return `<line x1="${PAD_L}" y1="${y}" x2="${W}" y2="${y}" stroke="var(--amber)" stroke-width="0.7" stroke-dasharray="4,4" opacity="0.35"/>
                <text x="${W - 2}" y="${parseFloat(y) - 3}" text-anchor="end" font-size="7.5" fill="var(--amber)" opacity="0.55" font-family="Roboto Mono,monospace">${lbl}</text>`;
            }).join("");

            // Month labels on x-axis — every point if ≤8, else every 2nd/3rd
            const step = n <= 8 ? 1 : n <= 16 ? 2 : 3;
            const tickLabels = sorted.map((s, i) => {
              if (i !== 0 && i !== n-1 && i % step !== 0) return "";
              const [yr, mo] = s.key.split("-");
              const lbl = new Date(+yr, +mo - 1, 1).toLocaleDateString("en-IN", { month: "short" });
              const anchor = i === 0 ? "start" : i === n-1 ? "end" : "middle";
              return `<text x="${toX(i).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}" font-size="8" fill="var(--dim)" font-family="Roboto Mono,monospace">${lbl}</text>`;
            }).join("");

            // Projection month labels
            const nextMonthLbl = (key, offset) => {
              const [yr, mo] = key.split("-").map(Number);
              return new Date(yr, mo - 1 + offset, 1).toLocaleDateString("en-IN", { month: "short" });
            };
            const lastKey = sorted[n-1].key;

            svg.innerHTML = `
              <defs>
                <linearGradient id="nwAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--mint)" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="var(--mint)" stop-opacity="0.02"/>
                </linearGradient>
                <linearGradient id="nwProjGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#c084fc" stop-opacity="0.15"/>
                  <stop offset="100%" stop-color="#c084fc" stop-opacity="0"/>
                </linearGradient>
              </defs>
              ${gridLines}
              ${milestoneLines}
              <path d="${areaPath}" fill="url(#nwAreaGrad)"/>
              <path d="${projArea}" fill="url(#nwProjGrad)"/>
              <polyline points="${lineStr}" fill="none" stroke="var(--mint)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
              <line x1="${lx}" y1="${ly}" x2="${px1}" y2="${py1}" stroke="#c084fc" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.8"/>
              <line x1="${px1}" y1="${py1}" x2="${px2}" y2="${py2}" stroke="#c084fc" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.8"/>
              <circle cx="${lx}" cy="${ly}" r="4" fill="var(--mint)" stroke="var(--bg)" stroke-width="1.5"/>
              <circle cx="${px2}" cy="${py2}" r="3.5" fill="#c084fc" stroke="var(--bg)" stroke-width="1.5" opacity="0.9"/>
              ${tickLabels}
              <text x="${px1}" y="${H - 6}" text-anchor="middle" font-size="8" fill="#c084fc" font-family="Roboto Mono,monospace" opacity="0.7">${nextMonthLbl(lastKey, 1)}</text>
              <text x="${px2}" y="${H - 6}" text-anchor="end" font-size="8" fill="#c084fc" font-family="Roboto Mono,monospace" opacity="0.7">${nextMonthLbl(lastKey, 2)} ↗</text>
            `;

            // Stats row below chart
            const ann = (Math.pow(1 + r, 12) - 1) * 100;
            const deltas = sorted.slice(1).map((s, i) => s.total - sorted[i].total);
            const bestMonth = deltas.length ? Math.max(...deltas) : 0;
            const statsEl = el("nwChartStats");
            if (statsEl) {
              statsEl.innerHTML = [
                `<span style="font-size:10.5px;color:var(--dim)">Best month&nbsp;<b style="color:var(--txt);font-family:'Roboto Mono',monospace">${fmt(bestMonth)}</b></span>`,
                `<span style="font-size:10.5px;color:var(--dim)">CAGR&nbsp;<b style="color:var(--mint);font-family:'Roboto Mono',monospace">${ann >= 0 ? "+" : ""}${ann.toFixed(1)}%</b></span>`,
                `<span style="font-size:10.5px;color:var(--dim)">Proj ${nextMonthLbl(lastKey, 2)}&nbsp;<b style="color:#c084fc;font-family:'Roboto Mono',monospace">${fmt(proj2)}</b></span>`,
              ].join("");
            }

            // Legend
            const legendEl = el("nwChartLegend");
            if (legendEl) {
              legendEl.innerHTML = `
                <span style="display:inline-flex;align-items:center;gap:5px;font-size:9.5px;color:var(--dim)">
                  <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="var(--mint)" stroke-width="2"/></svg>Actual
                </span>
                <span style="display:inline-flex;align-items:center;gap:5px;font-size:9.5px;color:var(--dim)">
                  <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#c084fc" stroke-width="1.5" stroke-dasharray="4,2"/></svg>Projection
                </span>`;
            }
          }

const NW_COMP_SERIES = [
            { key: "bank",     label: "Bank & Savings", color: "var(--liq)" },
            { key: "fd",       label: "Fixed Deposit",  color: "#5bc4f5" },
            { key: "cash",     label: "Cash",           color: "var(--amber)" },
            { key: "ppf",      label: "PPF",            color: "#8be8ff" },
            { key: "epf",      label: "EPF",            color: "#2dd4bf" },
            { key: "bonds",    label: "Bonds",          color: "#c084fc" },
            { key: "mf",       label: "MF Principal",   color: "#4ade9c" },
            { key: "mfProfit", label: "MF Growth",      color: "#86efac" },
          ];

export function renderNwCompositionChart() {
            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps)
              .map(([k, v]) => normalizeSnap(k, v))
              .sort((a, b) => a.key.localeCompare(b.key));

            const card = el("nwCompChartCard");
            if (!card) return;
            if (sorted.length < 2) { card.style.display = "none"; return; }
            card.style.display = "";

            const svg = el("nwCompChart");
            const W = 600, H = 150, PAD_T = 10, PAD_B = 24, PAD_L = 48, PAD_R = 8;
            const n = sorted.length;

            // Stacked-area bands — a snapshot's unrealized gain can be
            // negative (a paper loss), which a simple stack can't represent
            // as a slice; clip to 0 so a loss month just shows no growth
            // band rather than distorting the whole stack.
            const stacks = sorted.map(s => {
              let cum = 0;
              return NW_COMP_SERIES.map(ser => {
                const v = Math.max(0, s[ser.key] || 0);
                const base = cum;
                cum += v;
                return { base, top: cum };
              });
            });
            const maxV = Math.max(...stacks.map(row => row[row.length - 1].top), 1);

            const toX = i => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
            const toY = v => PAD_T + (1 - v / maxV) * (H - PAD_T - PAD_B);

            const areas = NW_COMP_SERIES.map((ser, si) => {
              const topPts  = stacks.map((row, i) => `${toX(i).toFixed(1)},${toY(row[si].top).toFixed(1)}`);
              const basePts = stacks.map((row, i) => `${toX(i).toFixed(1)},${toY(row[si].base).toFixed(1)}`).reverse();
              const d = `M${topPts.join(" L")} L${basePts.join(" L")} Z`;
              return `<path d="${d}" fill="${ser.color}" opacity="0.82" stroke="var(--bg)" stroke-width="0.5"/>`;
            }).join("");

            const gridLines = Array.from({ length: 4 }, (_, i) => {
              const v = maxV * (i + 1) / 5;
              const y = toY(v).toFixed(1);
              const lbl = v >= 10000000 ? (v/10000000).toFixed(1)+"Cr" : v >= 100000 ? (v/100000).toFixed(1)+"L" : (v/1000).toFixed(0)+"K";
              return `<line x1="${PAD_L}" y1="${y}" x2="${W}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
                <text x="${PAD_L - 4}" y="${parseFloat(y) + 3}" text-anchor="end" font-size="8" fill="var(--dim)" font-family="Roboto Mono,monospace">${lbl}</text>`;
            }).join("");

            const step = n <= 8 ? 1 : n <= 16 ? 2 : 3;
            const tickLabels = sorted.map((s, i) => {
              if (i !== 0 && i !== n-1 && i % step !== 0) return "";
              const [yr, mo] = s.key.split("-");
              const lbl = new Date(+yr, +mo - 1, 1).toLocaleDateString("en-IN", { month: "short" });
              const anchor = i === 0 ? "start" : i === n-1 ? "end" : "middle";
              return `<text x="${toX(i).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}" font-size="8" fill="var(--dim)" font-family="Roboto Mono,monospace">${lbl}</text>`;
            }).join("");

            svg.innerHTML = `${gridLines}${areas}${tickLabels}`;

            const legendEl = el("nwCompChartLegend");
            if (legendEl) {
              const active = NW_COMP_SERIES.filter((ser, si) => stacks.some(row => (row[si].top - row[si].base) > 0));
              legendEl.innerHTML = active.map(ser => `
                <span style="display:inline-flex;align-items:center;gap:5px;font-size:9px;color:var(--dim);margin-right:12px;margin-bottom:4px;">
                  <span style="width:8px;height:8px;border-radius:2px;background:${ser.color};display:inline-block;"></span>${ser.label}
                </span>`).join("");
            }
          }

export function renderNwProjection() {
            const snaps = state.networth.snapshots || {};
            const sorted = Object.entries(snaps)
              .map(([k, v]) => normalizeSnap(k, v))
              .sort((a, b) => a.key.localeCompare(b.key));

            if (sorted.length < 2) {
              const projPreviewEmpty = el("nwProjPreview");
              if (projPreviewEmpty) projPreviewEmpty.textContent = "";
              el("nwProjection").innerHTML =
                `<div style="color:var(--dim);font-size:12px;">
                Need at least 2 monthly snapshots to project. You have <b style="color:var(--txt)">${sorted.length}</b> so far.
              </div>`;
              return;
            }

            const r = avgMonthlyGrowthRate(sorted);
            const ann = (Math.pow(1 + r, 12) - 1) * 100;
            const cur = nwTotal(state.networth, LIQ_FUNDS, EQ_FUNDS, state.liquid, state.equity);
            const projPreview = el("nwProjPreview");
            if (projPreview) projPreview.textContent = "1yr " + fmt(cur * Math.pow(1 + r, 12));

            const cards = [
              { label: "3 months", months: 3 },
              { label: "6 months", months: 6 },
              { label: "1 year", months: 12 },
              { label: "2 years", months: 24 },
              { label: "5 years", months: 60 },
              { label: "10 years", months: 120 },
            ]
              .map((m) => {
                const proj = cur * Math.pow(1 + r, m.months);
                return `<div class="nw-proj-card">
                <div class="pk">${m.label}</div>
                <div class="pv">${fmt(proj)}</div>
                <div class="pg">+${fmt(proj - cur)}</div>
              </div>`;
              })
              .join("");

            el("nwProjection").innerHTML = `
              <div style="font-size:11px;color:var(--dim);margin-bottom:12px;">
                Based on <b style="color:var(--txt)">${sorted.length} snapshots</b> &mdash;
                avg <b style="color:var(--mint)">${ann >= 0 ? "+" : ""}${ann.toFixed(1)}%/yr</b>
                (<b style="color:var(--mint)">${(r * 100).toFixed(2)}%/mo</b>).
                Projected from current net worth <b style="color:var(--txt)">${fmt(cur)}</b>.
              </div>
              <div class="nw-proj-cards">${cards}</div>
              <p style="font-size:10px;color:var(--dim);margin-top:12px;line-height:1.6;">
                Simple compound model using your actual historical rate. Real returns vary.
              </p>`;

            renderNwMilestone(sorted, r, cur);
          }

// Next round net-worth milestone above your current total, and roughly when
// you'd reach it at the growth rate the cards above already use — "how much"
// vs "when", same underlying model.
const MILESTONE_LADDER = [1000000, 2500000, 5000000, 10000000, 20000000, 50000000, 100000000, 200000000, 500000000, 1000000000, 2000000000];

function renderNwMilestone(sorted, r, cur) {
            const wrap = el("nwMilestone");
            if (!wrap) return;
            if (sorted.length < 2) { wrap.innerHTML = ""; return; }

            const next = MILESTONE_LADDER.find(m => m > cur);
            if (!next) { wrap.innerHTML = ""; return; }

            if (r <= 0) {
              wrap.innerHTML = `<div style="font-size:11px;color:var(--dim);margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line);">
                Next milestone <b style="color:var(--txt)">${fmtCompact(next)}</b> — can't project an ETA while your recent growth rate is flat or negative.
              </div>`;
              return;
            }

            const monthsAway = Math.log(next / cur) / Math.log(1 + r);
            const etaDate = new Date();
            etaDate.setMonth(etaDate.getMonth() + Math.round(monthsAway));
            const etaLabel = etaDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
            const awayLabel = monthsAway >= 12 ? (monthsAway / 12).toFixed(1) + " yr" : Math.round(monthsAway) + " mo";

            wrap.innerHTML = `<div style="font-size:11px;color:var(--dim);margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line);">
              Next milestone <b style="color:var(--mint);font-family:'Roboto Mono',monospace">${fmtCompact(next)}</b> —
              projected <b style="color:var(--txt)">${etaLabel}</b> <span style="opacity:0.8">(~${awayLabel} away)</span> at your current growth rate.
            </div>`;
          }
