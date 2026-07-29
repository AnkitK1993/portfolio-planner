// Shared coordinate math + path-string builder for the small trend-line
// sparklines used on Health Score and Portfolio XIRR (features/summary/
// index.js) — every caller supplies its own Y-scaling policy (fixed-domain
// vs auto-scaled) and its own color/marker/extra-line choices, since those
// genuinely differ per chart; only the x-positioning and path assembly,
// which were byte-for-byte identical in both existing charts, live here.
export function buildTrendLine(values, { width = 300, height = 44, padding = 4, toY }) {
            const n = values.length;
            const toX = i => padding + (i / (n - 1)) * (width - padding * 2);
            const lineStr = values.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
            return { toX, toY, lineStr, lastX: toX(n - 1), lastY: toY(values[n - 1]) };
          }

// Full reusable trend-line sparkline — the complete component built on
// buildTrendLine() above: resolves the Y-axis domain (a fixed [min, max]
// range like Health Score's 0–100, or "auto" — auto-scaled but always
// including zero, like Portfolio XIRR's), handles the "not enough data
// yet" empty state, and assembles the final SVG markup. colorFor is
// required rather than defaulted because the two existing consumers
// have genuinely incompatible thresholds (a 4-tier grade scale vs. a
// plain positive/negative sign) — there's no sane one-size color rule.
//
// The two real consumers also disagree on WHAT "not enough data" looks
// like: Health Score keeps its section always visible and swaps the
// chart for a hint sentence (hintEl); Portfolio XIRR hides its entire
// labeled wrapper with no hint text at all (wrapEl). Both are supported
// rather than picking one shape and forcing the other consumer into it.
export function renderTrendChart(svgEl, hintEl, values, {
  minPoints = 3,
  width = 300,
  height = 44,
  padding = 4,
  yDomain = "auto",
  colorFor,
  showZeroLine = false,
  wrapEl,
} = {}) {
            if (!svgEl) return;
            if (values.length < minPoints) {
              if (wrapEl) { wrapEl.style.display = "none"; return; }
              svgEl.style.display = "none";
              if (hintEl) hintEl.style.display = "";
              return;
            }
            if (wrapEl) wrapEl.style.display = "";
            svgEl.style.display = "";
            if (hintEl) hintEl.style.display = "none";

            const [domainMin, domainMax] = Array.isArray(yDomain)
              ? yDomain
              : [Math.min(...values, 0), Math.max(...values, 0)];
            const range = (domainMax - domainMin) || 1;
            const toY = v => height - padding - ((v - domainMin) / range) * (height - padding * 2);

            const { lineStr, lastX, lastY } = buildTrendLine(values, { width, height, padding, toY });
            const last = values[values.length - 1];
            const color = colorFor(last);

            const zeroLineHtml = showZeroLine
              ? `<line x1="${padding}" y1="${toY(0).toFixed(1)}" x2="${width - padding}" y2="${toY(0).toFixed(1)}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3,3"/>`
              : "";

            svgEl.innerHTML = `
              ${zeroLineHtml}
              <path d="${lineStr}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
              <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.5" fill="${color}"/>
            `;
          }
