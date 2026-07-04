import { UI } from "../../core/ui.js";

export const ACCENT_THEMES = [
            {
              key: "neo-cyber-grid", name: "Neo Cyber Grid",
              bg: "#04040f", panel: "#0a0a20", panel2: "#0e0e28", line: "#181840",
              txt: "#c8e8ff", dim: "#3a5888",
              mint: "#00e5ff", mintDim: "#00253a",
              liq: "#407cff", liqDim: "#0f1f40",
              amber: "#ff7c00", amberDim: "#3a1a00", coral: "#ff4060",
              swatchColors: ["#00e5ff", "#407cff", "#ff7c00"]
            },
            {
              key: "glassmorphism-pro", name: "Glassmorphism Pro",
              bg: "#0c0f1e", panel: "#131728", panel2: "#1a1f35", line: "#242d50",
              txt: "#cdd4ff", dim: "#5060a5",
              mint: "#818cf8", mintDim: "#1e2350",
              liq: "#5ba3ef", liqDim: "#112540",
              amber: "#fb923c", amberDim: "#3a1500", coral: "#f87171",
              swatchColors: ["#818cf8", "#5ba3ef", "#fb923c"]
            },
            {
              key: "luxe-black-gold", name: "Minimal Luxe B+G",
              bg: "#040404", panel: "#0c0c0c", panel2: "#141414", line: "#222222",
              txt: "#f5eedc", dim: "#7a6840",
              mint: "#c9a227", mintDim: "#362800",
              liq: "#a8832c", liqDim: "#281f00",
              amber: "#d97706", amberDim: "#3a1c00", coral: "#e05050",
              swatchColors: ["#c9a227", "#a8832c", "#d97706"]
            },
            {
              key: "liquid-neon-flow", name: "Liquid Neon Flow",
              bg: "#08030e", panel: "#100820", panel2: "#180c2c", line: "#251540",
              txt: "#f0d8ff", dim: "#6040a0",
              mint: "#e040fb", mintDim: "#3a0050",
              liq: "#7c4dff", liqDim: "#1f0a40",
              amber: "#ff4081", amberDim: "#3a0020", coral: "#ff6b9e",
              swatchColors: ["#e040fb", "#7c4dff", "#ff4081"]
            },
            {
              key: "ai-command-center", name: "AI Command Center",
              bg: "#020810", panel: "#070f1c", panel2: "#0d1828", line: "#132238",
              txt: "#c0e8ff", dim: "#285880",
              mint: "#00c8ff", mintDim: "#001e36",
              liq: "#4090ff", liqDim: "#0a1a40",
              amber: "#ff8c00", amberDim: "#3a1a00", coral: "#ff6b6b",
              swatchColors: ["#00c8ff", "#4090ff", "#ff8c00"]
            },
            {
              key: "calm-wealth-green", name: "Calm Wealth Green",
              bg: "#030b05", panel: "#071008", panel2: "#0c180d", line: "#142418",
              txt: "#d0f0d5", dim: "#3a6045",
              mint: "#00c853", mintDim: "#003018",
              liq: "#40c07a", liqDim: "#0f2e20",
              amber: "#8bc34a", amberDim: "#1e2e08", coral: "#ff6b6b",
              swatchColors: ["#00c853", "#40c07a", "#8bc34a"]
            },
            {
              key: "neon-purple-matrix", name: "Neon Purple Matrix",
              bg: "#040208", panel: "#0b0615", panel2: "#100c1e", line: "#1c1230",
              txt: "#e8d0ff", dim: "#5a38a0",
              mint: "#c060ff", mintDim: "#280050",
              liq: "#8040e8", liqDim: "#180038",
              amber: "#ff40c0", amberDim: "#3a0030", coral: "#ff8080",
              swatchColors: ["#c060ff", "#8040e8", "#ff40c0"]
            },
            {
              key: "dark-warm-amber", name: "Dark + Warm Amber",
              bg: "#0a0602", panel: "#160d04", panel2: "#1e1208", line: "#2e1c0a",
              txt: "#f8edd8", dim: "#806040",
              mint: "#f59e0b", mintDim: "#3a2400",
              liq: "#fb923c", liqDim: "#3a1200",
              amber: "#ef4444", amberDim: "#380a0a", coral: "#ff6b6b",
              swatchColors: ["#f59e0b", "#fb923c", "#ef4444"]
            },
            {
              key: "data-grid-minimal", name: "Data Grid Minimal",
              bg: "#050505", panel: "#0c0c0c", panel2: "#121212", line: "#1e1e1e",
              txt: "#d5e8d5", dim: "#3e5040",
              mint: "#4a9c5f", mintDim: "#0f2015",
              liq: "#4a80a0", liqDim: "#0f2030",
              amber: "#9a8050", amberDim: "#1e180a", coral: "#c06060",
              swatchColors: ["#4a9c5f", "#4a80a0", "#9a8050"]
            },
            {
              key: "gradient-edge-glow", name: "Gradient Edge Glow",
              bg: "#060610", panel: "#0e0e20", panel2: "#14142c", line: "#1e1e3e",
              txt: "#f0e8ff", dim: "#5850a5",
              mint: "#00f5a0", mintDim: "#003828",
              liq: "#7c3aed", liqDim: "#1a0840",
              amber: "#f43f5e", amberDim: "#380a18", coral: "#ff8c60",
              swatchColors: ["#00f5a0", "#7c3aed", "#f43f5e"]
            },
          ];

export let currentAccentIdx = 0;

export let themeMatrixOpen = false;

export function applyAccent(idx, silent) {
            const t = ACCENT_THEMES[idx];
            const r = document.documentElement.style;
            r.setProperty("--bg",        t.bg);
            r.setProperty("--panel",     t.panel);
            r.setProperty("--panel-2",   t.panel2);
            r.setProperty("--line",      t.line);
            r.setProperty("--txt",       t.txt);
            r.setProperty("--dim",       t.dim);
            r.setProperty("--mint",      t.mint);
            r.setProperty("--mint-dim",  t.mintDim);
            r.setProperty("--liq",       t.liq);
            r.setProperty("--liq-dim",   t.liqDim);
            r.setProperty("--amber",     t.amber);
            r.setProperty("--amber-dim", t.amberDim);
            r.setProperty("--coral",     t.coral);
            document.body.dataset.theme = t.key;
            currentAccentIdx = idx;
            localStorage.setItem("accent_theme", t.key);

            /* Update favicon */
            const fav = document.getElementById("faviconEl");
            if (fav) {
              const c = encodeURIComponent(t.mint);
              fav.href = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230c0f0e'/%3E%3Cpolyline points='4,24 10,15 15,19 21,9 28,13' fill='none' stroke='${c}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='4' cy='24' r='1.8' fill='${c}'/%3E%3Ccircle cx='28' cy='13' r='1.8' fill='${c}'/%3E%3C%2Fsvg%3E`;
            }

            /* Highlight active swatch in matrix popup */
            document.querySelectorAll(".theme-swatch").forEach((s, i) => {
              s.classList.toggle("active", i === idx);
            });
            /* Highlight active swatch in sidebar */
            document.querySelectorAll(".sb-theme-btn").forEach((s, i) => {
              s.classList.toggle("active", i === idx);
            });

            if (!silent) UI.toast("info", t.name, 1800);
          }

export function loadSavedAccent() {
            const saved = localStorage.getItem("accent_theme");
            const idx = saved ? ACCENT_THEMES.findIndex((t) => t.key === saved) : -1;
            applyAccent(idx >= 0 ? idx : 0, true);
          }

export function buildThemeMatrix() {
            const grid = document.getElementById("themeMatrixGrid");
            if (!grid) return;
            ACCENT_THEMES.forEach((t, i) => {
              const btn = document.createElement("button");
              btn.className = "theme-swatch" + (i === currentAccentIdx ? " active" : "");
              btn.setAttribute("aria-label", t.name);
              const dots = t.swatchColors.map(c => `<span class="theme-swatch-dot" style="background:${c}"></span>`).join("");
              btn.innerHTML =
                `<span class="theme-swatch-dots">${dots}</span>` +
                `<span class="theme-swatch-name">${t.name}</span>`;
              btn.addEventListener("click", (e) => {
                e.stopPropagation();
                applyAccent(i);
                setTimeout(hideThemeMatrix, 320);
              });
              grid.appendChild(btn);
            });
          }

export function showThemeMatrix(anchorEl) {
            const matrix = document.getElementById("themeMatrix");
            if (!matrix) return;
            themeMatrixOpen = true;

            const rect = anchorEl.getBoundingClientRect();
            const mw = 308;
            let left = rect.left;
            if (left + mw > window.innerWidth - 16) left = window.innerWidth - mw - 16;
            if (left < 8) left = 8;
            matrix.style.left = left + "px";
            /* If anchor is in bottom half of screen (mobile nav), open upward */
            if (rect.top > window.innerHeight / 2) {
              matrix.style.top = "auto";
              matrix.style.bottom = (window.innerHeight - rect.top + 8) + "px";
            } else {
              matrix.style.bottom = "auto";
              matrix.style.top = (rect.bottom + 8) + "px";
            }
            matrix.style.display = "block";
          }

export function hideThemeMatrix() {
            const matrix = document.getElementById("themeMatrix");
            if (matrix) matrix.style.display = "none";
            themeMatrixOpen = false;
          }
