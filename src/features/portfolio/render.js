import { EQ_FUNDS, LIQ_FUNDS, state } from "../../core/state.js";
import { clamp, fmt, pct, roundUpInvest } from "../../core/format.js";
import { el } from "../../core/dom.js";
import { fundXirr } from "../../domain/xirr.js";
import { renderCalendar } from "./calendar.js";
import { renderForecast } from "../forecast/index.js";
import { renderHoldings } from "../transactions/index.js";
import { renderNetWorth } from "../networth/index.js";
import { renderRebalance } from "../summary/rebalance.js";
import { renderSparklines, renderSummaryExtras } from "../summary/index.js";
import { renderUpcoming } from "./upcoming.js";
import { setAllocBar } from "./allocation.js";
import { setAnimOnRender, setFmtInner } from "../../core/animate.js";

export let _raf = 0;

export function scheduleRender() {
            cancelAnimationFrame(_raf);
            _raf = requestAnimationFrame(render);
          }

export function render() {
            /* — Liquid funds — */
            let totalLiqVal = 0,
              totalLiqCurVal = 0,
              totalDep = 0,
              totalLiqTgt = 0,
              totalLiqInv = 0,
              totalLiqAE = 0,
              totalLiqRet = 0;
            LIQ_FUNDS.forEach((f) => {
              const paid = state.liquid[f.id].paid || 0;
              const val = state.liquid[f.id].value || 0;
              const res = Math.min(state.liquid[f.id].reserve || 0, val);
              const dep = Math.max(0, val - res);
              const tgt = state.liquid[f.id].target || 0;
              const gap = tgt - val;
              const required = gap > 0 ? gap : 0;

              totalLiqVal += val;
              totalDep += dep;
              totalLiqTgt += tgt;
              totalLiqInv += required;

              const liqRatePct = paid > 0 && val > 0 ? ((paid - val) / paid) * 100 : null;
              el("lrate-" + f.id).textContent =
                liqRatePct !== null
                  ? liqRatePct.toFixed(4).replace(/\.?0+$/, "") + "%"
                  : "—";

              el("ldep-" + f.id).textContent = fmt(dep);
              el("linvlbl-" + f.id).textContent =
                required > 0
                  ? "Invest now"
                  : tgt > 0
                    ? "Goal reached ✓"
                    : "Invest now";
              el("linv-" + f.id).textContent = fmt(required);
              const resPct = val > 0 ? Math.round((res / val) * 100) : 0;
              el("lrespct-" + f.id).textContent = resPct + "% reserved";
              el("ldepfill-" + f.id).style.width =
                val > 0 ? Math.round((dep / val) * 100) + "%" : "0%";
              /* Current Value + Returns (vs after expense) */
              const lcv = state.liquid[f.id].currentValue || val;
              totalLiqCurVal += lcv;
              const lcvInp = el("lcurval-" + f.id);
              if (lcvInp) lcvInp.value = lcv > 0 ? Math.round(lcv).toLocaleString("en-IN") : "";
              const lret = lcv - val;
              const lrtnEl = el("lrtn-" + f.id);
              if (lrtnEl) {
                if (lcv <= 0 || val === 0) {
                  lrtnEl.className = "rtn-display"; lrtnEl.innerHTML = "—";
                } else {
                  const isUp  = lret >= 0;
                  const arrow = isUp ? "↑" : "↓";
                  const sign  = isUp ? "+" : "−";
                  const amt   = Math.abs(Math.round(lret)).toLocaleString("en-IN");
                  const pct   = (Math.abs(lret) / val * 100).toFixed(2);
                  lrtnEl.className = `rtn-display ${isUp ? "rtn-up" : "rtn-dn"}`;
                  lrtnEl.innerHTML = `<span class="rtn-arrow">${arrow}</span><span class="rtn-amt">₹${amt}</span><span class="rtn-pct">(${sign}${pct}%)</span>`;
                  totalLiqAE += val; totalLiqRet += lret;
                }
              }
              /* Per-fund collapsible header badge */
              const lcollRtn = el("coll-rtn-" + f.id);
              if (lcollRtn) {
                if (lcv > 0 && val > 0) {
                  const isUp = lret >= 0;
                  const pct  = (Math.abs(lret) / val * 100).toFixed(2);
                  lcollRtn.textContent = (isUp ? "↑" : "↓") + " " + (isUp ? "+" : "−") + pct + "%";
                  lcollRtn.className = "coll-rtn " + (isUp ? "up" : "dn");
                } else { lcollRtn.textContent = ""; lcollRtn.className = "coll-rtn"; }
              }
              /* XIRR badge */
              const lxirrBadge = el("coll-xirr-" + f.id);
              if (lxirrBadge) {
                const x = fundXirr(f.id, true);
                if (x !== null) {
                  const p = (x * 100).toFixed(1);
                  const up = x >= 0;
                  const label = (up ? "+" : "") + p + "% pa";
                  lxirrBadge.textContent = label;
                  lxirrBadge.className = "coll-xirr " + (up ? "up" : "dn");
                  lxirrBadge.style.display = "";
                  const inner = el("lxirr-inner-" + f.id);
                  if (inner) {
                    inner.textContent = "XIRR " + label;
                    inner.className = "fund-xirr-line " + (up ? "up" : "dn");
                    inner.style.display = "flex";
                  }
                } else {
                  lxirrBadge.style.display = "none";
                  const inner = el("lxirr-inner-" + f.id);
                  if (inner) inner.style.display = "none";
                }
              }
              /* Split row */
              const lsplit = el("lsplit-" + f.id);
              if (lsplit) {
                const s2 = state.liquid[f.id];
                const chips = [
                  s2.sipPaid  > 0 ? `<span class="split-chip split-chip-sip">SIP ${fmt(s2.sipPaid)}</span>`    : "",
                  s2.lumpPaid > 0 ? `<span class="split-chip split-chip-lump">Lump ${fmt(s2.lumpPaid)}</span>` : "",
                  s2.redeemPaid > 0 ? `<span class="split-chip split-chip-redeem">−${fmt(s2.redeemPaid)}</span>` : "",
                ].join("");
                lsplit.innerHTML = chips;
              }
            });

            /* Deployable summary bar */
            el("totalDep").textContent = fmt(totalDep);
            const liqNames = LIQ_FUNDS.map(
              (f) => state.liquid[f.id].name || f.defaultName,
            ).join(" + ");
            el("depNote").textContent =
              totalLiqVal > 0
                ? fmt(totalLiqVal - totalDep) + " reserved across " + liqNames
                : "Enter liquid fund values above";

            /* — Liquid division row + per-fund collapsible headers — */
            setFmtInner("liqDivTotal", totalLiqCurVal);
            const liqDivRtnEl = el("liqDivRtn");
            if (liqDivRtnEl) {
              if (totalLiqAE > 0) {
                const isUp = totalLiqRet >= 0;
                const pct  = (Math.abs(totalLiqRet) / totalLiqAE * 100).toFixed(2);
                liqDivRtnEl.textContent = (isUp ? "↑" : "↓") + " " + (isUp ? "+" : "−") + pct + "%";
                liqDivRtnEl.className = "fund-div-rtn " + (isUp ? "up" : "dn");
              } else { liqDivRtnEl.textContent = ""; liqDivRtnEl.className = "fund-div-rtn"; }
            }
            LIQ_FUNDS.forEach(f => {
              const nameEl = el("coll-name-" + f.id);
              if (nameEl && document.activeElement !== nameEl) nameEl.value = state.liquid[f.id].label || f.defaultName;
              setFmtInner("coll-val-" + f.id, state.liquid[f.id].currentValue || state.liquid[f.id].value || 0);
            });

            /* — Equity funds — */
            let eqCur = 0,
              totalEqCurVal = 0,
              eqTgt = 0,
              eqInv = 0,
              totDuty = 0,
              totalEqAE = 0,
              totalEqRet = 0;

            EQ_FUNDS.forEach((f) => {
              const s = state.equity[f.id];
              const paid = s.paid || 0;
              const shown = s.shown || 0;
              const tgt = s.target || 0;

              const eqRatePct = paid > 0 && shown > 0 ? ((paid - shown) / paid) * 100 : null;
              const rate = eqRatePct !== null ? eqRatePct / 100 : 0;

              const cur = shown > 0 ? shown : 0;
              const targetVal = tgt > 0 ? tgt : cur;
              const gap = targetVal - cur;
              const required = gap > 0 ? roundUpInvest(gap, rate) : 0;
              const duty = required * rate;
              totDuty += duty;

              el("erate-" + f.id).textContent =
                eqRatePct !== null
                  ? eqRatePct.toFixed(4).replace(/\.?0+$/, "") + "%"
                  : "—";

              if (required > 0) {
                el("einvlbl-" + f.id).textContent = "Invest now";
                el("einv-" + f.id).textContent = fmt(required);
              } else if (tgt > 0 && cur > 0 && gap <= 0) {
                el("einvlbl-" + f.id).textContent = "Goal reached ✓";
                el("einv-" + f.id).textContent = fmt(0);
              } else {
                el("einvlbl-" + f.id).textContent = "Invest now";
                el("einv-" + f.id).textContent = fmt(0);
              }

              /* Current Value + Returns (vs after expense) */
              const ecv = s.currentValue || shown;
              totalEqCurVal += ecv;
              const ecvInp = el("ecurvval-" + f.id);
              if (ecvInp) ecvInp.value = ecv > 0 ? Math.round(ecv).toLocaleString("en-IN") : "";
              const eret = ecv - shown;
              const ertnEl = el("ertn-" + f.id);
              if (ertnEl) {
                if (ecv <= 0 || shown === 0) {
                  ertnEl.className = "rtn-display"; ertnEl.innerHTML = "—";
                } else {
                  const isUp  = eret >= 0;
                  const arrow = isUp ? "↑" : "↓";
                  const sign  = isUp ? "+" : "−";
                  const amt   = Math.abs(Math.round(eret)).toLocaleString("en-IN");
                  const pct   = (Math.abs(eret) / shown * 100).toFixed(2);
                  ertnEl.className = `rtn-display ${isUp ? "rtn-up" : "rtn-dn"}`;
                  ertnEl.innerHTML = `<span class="rtn-arrow">${arrow}</span><span class="rtn-amt">₹${amt}</span><span class="rtn-pct">(${sign}${pct}%)</span>`;
                  totalEqAE += shown; totalEqRet += eret;
                }
              }
              /* Per-fund collapsible header badge */
              const ecollRtn = el("coll-rtn-" + f.id);
              if (ecollRtn) {
                if (ecv > 0 && shown > 0) {
                  const isUp = eret >= 0;
                  const pct  = (Math.abs(eret) / shown * 100).toFixed(2);
                  ecollRtn.textContent = (isUp ? "↑" : "↓") + " " + (isUp ? "+" : "−") + pct + "%";
                  ecollRtn.className = "coll-rtn " + (isUp ? "up" : "dn");
                } else { ecollRtn.textContent = ""; ecollRtn.className = "coll-rtn"; }
              }
              /* XIRR badge */
              const exirrBadge = el("coll-xirr-" + f.id);
              if (exirrBadge) {
                const x = fundXirr(f.id, false);
                if (x !== null) {
                  const p = (x * 100).toFixed(1);
                  const up = x >= 0;
                  const label = (up ? "+" : "") + p + "% pa";
                  exirrBadge.textContent = label;
                  exirrBadge.className = "coll-xirr " + (up ? "up" : "dn");
                  exirrBadge.style.display = "";
                  const inner = el("exirr-inner-" + f.id);
                  if (inner) {
                    inner.textContent = "XIRR " + label;
                    inner.className = "fund-xirr-line " + (up ? "up" : "dn");
                    inner.style.display = "flex";
                  }
                } else {
                  exirrBadge.style.display = "none";
                  const inner = el("exirr-inner-" + f.id);
                  if (inner) inner.style.display = "none";
                }
              }
              /* Split row */
              const esplit = el("esplit-" + f.id);
              if (esplit) {
                const s2 = state.equity[f.id];
                const chips = [
                  s2.sipPaid  > 0 ? `<span class="split-chip split-chip-sip">SIP ${fmt(s2.sipPaid)}</span>`    : "",
                  s2.lumpPaid > 0 ? `<span class="split-chip split-chip-lump">Lump ${fmt(s2.lumpPaid)}</span>` : "",
                  s2.redeemPaid > 0 ? `<span class="split-chip split-chip-redeem">−${fmt(s2.redeemPaid)}</span>` : "",
                ].join("");
                esplit.innerHTML = chips;
              }

              eqCur += cur;
              eqTgt += targetVal;
              eqInv += required;
            });

            /* — Equity division row + per-fund collapsible headers — */
            setFmtInner("eqDivTotal", totalEqCurVal);
            const eqDivRtnEl = el("eqDivRtn");
            if (eqDivRtnEl) {
              if (totalEqAE > 0) {
                const isUp = totalEqRet >= 0;
                const pct  = (Math.abs(totalEqRet) / totalEqAE * 100).toFixed(2);
                eqDivRtnEl.textContent = (isUp ? "↑" : "↓") + " " + (isUp ? "+" : "−") + pct + "%";
                eqDivRtnEl.className = "fund-div-rtn " + (isUp ? "up" : "dn");
              } else { eqDivRtnEl.textContent = ""; eqDivRtnEl.className = "fund-div-rtn"; }
            }
            EQ_FUNDS.forEach(f => {
              const s = state.equity[f.id];
              const nameEl = el("coll-name-" + f.id);
              if (nameEl && document.activeElement !== nameEl) nameEl.value = s.label || f.defaultName;
              setFmtInner("coll-val-" + f.id, s.currentValue || s.shown || 0);
            });

            /* — Summary table — */
            const totCur = eqCur + totalLiqVal;
            const totTgt = eqTgt + totalLiqTgt;
            const totInv = eqInv + totalLiqInv;
            el("eqCur").textContent = fmt(eqCur);
            el("eqTgt").textContent = fmt(eqTgt);
            el("eqInv").textContent = fmt(eqInv);
            el("liqCur").textContent = fmt(totalLiqVal);
            el("liqTgt").textContent = fmt(totalLiqTgt);
            el("liqInv").textContent = fmt(totalLiqInv);
            el("totCur").textContent = fmt(totCur);
            el("totTgt").textContent = fmt(totTgt);
            el("totInv").textContent = fmt(totInv);

            /* Hero */
            el("heroLabel").textContent = "Total investment required";
            el("heroVal").textContent = fmt(totInv);
            el("heroSub").textContent =
              "To reach targets across equity + liquid funds";

            /* Allocation bars */
            const nowEqPct = pct(eqCur, totCur);
            setAllocBar("curEqSeg", "curLiqSeg", "curSplit", nowEqPct, totCur);
            const tgtEqPct = pct(eqTgt, totTgt);
            setAllocBar("tgtEqSeg", "tgtLiqSeg", "tgtSplit", tgtEqPct, totTgt);

            /* Stats */
            const funded = pct(eqCur, eqTgt);
            el("fundedPct").textContent = Math.round(funded) + "%";
            el("fundedBar").style.width = clamp(funded, 0, 100) + "%";
            el("totDuty").textContent = fmt(totDuty);

            renderSummaryExtras(eqCur, liqCur, totCur, eqTgt, liqTgt, totTgt, nowEqPct, tgtEqPct);
            renderSparklines();
            renderNetWorth();
            renderUpcoming();
            renderHoldings();
            renderCalendar();
            const _activeTab = document.querySelector(".tab-section.active")?.id;
            if (_activeTab === "tab-forecast") renderForecast();
            if (_activeTab === "tab-rebalance") renderRebalance();
            setAnimOnRender(false); // reset after first render; re-set by navigateTo()
          }
