import { MONTHS } from "./constants.js";

export const fmt = (n) =>
            "₹" + Math.max(0, Math.round(n)).toLocaleString("en-IN");

export const fmtInner = (n, fallback = "") => {
            if (!n || n <= 0) return fallback;
            const num = Math.max(0, Math.round(n)).toLocaleString("en-IN");
            return `<span class="val-pfx">₹</span><span class="val-num">${num}</span>`;
          };

export const num = (v) => Number(String(v || "").replace(/,/g, "")) || 0;

export const fmtNum = (v) => (v > 0 ? Math.round(v).toLocaleString("en-IN") : "");

// Lets a field double as a quick add/subtract calculator — typing
// "5000+2000-500" sums the signed terms instead of requiring the user
// to do the arithmetic themselves before entering a single number.
// Deliberately +/- only (no *, /, parens): that's the one thing users
// asked for, and it's safe to do with a regex scan rather than needing
// a real expression parser or eval(). A plain number with no operators
// behaves exactly like num() — same fallback of 0 for empty/invalid.
export const evalArithmetic = (v) => {
            const cleaned = String(v || "").replace(/,/g, "");
            const terms = cleaned.match(/[+-]?\d*\.?\d+/g);
            if (!terms) return 0;
            return terms.reduce((sum, t) => sum + parseFloat(t), 0);
          };

export const fmtCompact = (n) => {
            const v = Math.round(n || 0);
            const sign = v < 0 ? "−" : "";
            const abs = Math.abs(v);
            if (abs >= 1e7) return sign + "₹" + (abs / 1e7).toFixed(2).replace(/\.?0+$/, "") + "Cr";
            if (abs >= 1e5) return sign + "₹" + (abs / 1e5).toFixed(2).replace(/\.?0+$/, "") + "L";
            if (abs >= 1e3) return sign + "₹" + (abs / 1e3).toFixed(1).replace(/\.?0+$/, "") + "K";
            return sign + "₹" + abs;
          };

export const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const roundUpInvest = (target, rate) =>
            target > 0 && rate < 1 ? Math.ceil(target / (1 - rate)) : 0;

export function fmtMonth(key) {
            const [y, m] = key.split("-").map(Number);
            return MONTHS[m - 1] + " " + y;
          }
