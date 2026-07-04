import { EQ_FUNDS, LIQ_FUNDS, editMode, state } from "../../core/state.js";
import { _animOnRender, animateWidth } from "../../core/animate.js";
import { el } from "../../core/dom.js";
import { fmt, pct } from "../../core/format.js";

export function setAllocBar(eqId, liqId, splitId, eqPct, total) {
            const liqPct = 100 - eqPct;
            el(eqId).style.width = eqPct + "%";
            el(liqId).style.width = liqPct + "%";
            el(eqId).textContent = eqPct >= 14 ? Math.round(eqPct) + "%" : "";
            el(liqId).textContent = liqPct >= 14 ? Math.round(liqPct) + "%" : "";
            el(splitId).textContent =
              total > 0
                ? Math.round(eqPct) + "% eq / " + Math.round(liqPct) + "% liq"
                : "—";
          }

export const ALLOC_PALETTE = [
            "#4ade80","#38bdf8","#f59e0b","#f87171","#a78bfa",
            "#60a5fa","#34d399","#fb923c","#e879f9","#22d3ee",
            "#84cc16","#c084fc","#fbbf24","#2dd4bf","#f472b6"
          ];

export function renderAllocBars() {
            const container = el("sumAllocBarsMain");
            if (!container) return;

            // Build fund lists with assigned colors from the shared palette
            let paletteIdx = 0;
            const liqFunds = LIQ_FUNDS.map(f => {
              const s = state.liquid[f.id];
              return { name: (s?.name || f.defaultName), value: s?.value || 0, color: ALLOC_PALETTE[paletteIdx++] };
            }).filter(f => f.value > 0);

            const eqFunds = EQ_FUNDS.map(f => {
              const s = state.equity[f.id];
              return { name: (s?.name || f.defaultName), value: s?.shown || 0, color: ALLOC_PALETTE[paletteIdx++ % ALLOC_PALETTE.length] };
            }).filter(f => f.value > 0);

            const grandTotal = liqFunds.reduce((s, f) => s + f.value, 0) +
                               eqFunds.reduce((s, f) => s + f.value, 0);

            if (grandTotal === 0) {
              container.innerHTML = `<div style="font-size:11px;color:var(--dim);padding:8px 0">Enter fund values on the Portfolio tab to see allocation.</div>`;
              return;
            }

            const liqTotal = liqFunds.reduce((s, f) => s + f.value, 0);
            const eqTotal  = eqFunds.reduce((s, f) => s + f.value, 0);

            // All funds sorted descending for Total bar
            const allFunds = [...liqFunds, ...eqFunds].sort((a, b) => b.value - a.value);

            // Helper — renders one labeled segmented bar + vertical legend
            const mkSection = (label, funds, sectionTotal) => {
              if (!funds.length || sectionTotal === 0) return "";

              const segments = funds.map(f => {
                const pct = (f.value / sectionTotal) * 100;
                const showLabel = pct >= 10;
                return `<div style="flex:${pct.toFixed(2)};background:${f.color};min-width:3px;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;" title="${f.name}: ${fmt(f.value)}">
                  ${showLabel ? `<span style="font-size:9px;font-weight:700;color:#0a0f0e;pointer-events:none;white-space:nowrap;padding:0 3px;">${Math.round(pct)}%</span>` : ""}
                </div>`;
              }).join("");

              const legend = funds.map(f => {
                const pct = ((f.value / sectionTotal) * 100).toFixed(1);
                const ofTotal = ((f.value / grandTotal) * 100).toFixed(1);
                return `<div style="display:grid;grid-template-columns:12px 1fr auto auto;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);">
                  <span style="width:12px;height:12px;border-radius:3px;background:${f.color};flex-shrink:0;display:block;"></span>
                  <span style="font-size:12px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>
                  <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--dim);text-align:right;white-space:nowrap;">${fmt(f.value)}</span>
                  <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${f.color};text-align:right;min-width:42px;white-space:nowrap;">${pct}%</span>
                </div>`;
              }).join("");

              const pctOfGrand = sectionTotal > 0 ? ((sectionTotal / grandTotal) * 100).toFixed(1) : "0";
              return `<div style="margin-bottom:22px;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;">
                  <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.9px;color:var(--dim)">${label}</span>
                  <span style="font-size:11px;color:var(--dim);font-family:'IBM Plex Mono',monospace;">${fmt(sectionTotal)} &nbsp;<span style="font-size:9px">(${pctOfGrand}% of total)</span></span>
                </div>
                <div class="alloc-seg-bar" style="display:flex;height:28px;border-radius:7px;overflow:hidden;gap:1px;">${segments}</div>
                <div style="margin-top:2px;">${legend}</div>
              </div>`;
            };

            container.innerHTML =
              mkSection("Liquid", liqFunds, liqTotal) +
              mkSection("Equity", eqFunds, eqTotal) +
              mkSection("Total", allFunds, grandTotal);
            if (_animOnRender && !editMode)
              container.querySelectorAll(".alloc-seg-bar").forEach(bar => animateWidth(bar, 100, 1000));
          }
