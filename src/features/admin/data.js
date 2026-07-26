import { UI } from "../../core/ui.js";
import { applyCloudState } from "../../infra/firebase.js";
import { saveState, state } from "../../core/state.js";
import { el } from "../../core/dom.js";
import { renderReturns, renderTxns } from "../transactions/index.js";

export function exportData() {
            const filename = "portfolio-backup-" + new Date().toISOString().slice(0, 10) + ".json";
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            UI.toast("success", "Backup downloaded: " + filename, 3000);
          }

export function importData(e) {
            const file = e.target.files[0];
            if (!file) return;
            e.target.value = ""; // reset so same file can be re-imported
            const reader = new FileReader();
            reader.onload = ev => {
              try {
                const raw = JSON.parse(ev.target.result);
                if (!raw.liquid || !raw.equity) {
                  UI.toast("error", "Invalid backup file — missing fund data", 4000);
                  return;
                }
                UI.confirm("This will replace all your current portfolio data.", "Restore backup?", "Restore", () => {
                  applyCloudState(raw);
                  saveState();
                  renderTxns();
                  renderReturns();
                  el("dataModal").style.display = "none";
                  UI.toast("success", "Data restored from backup", 3000);
                }, false);
              } catch {
                UI.toast("error", "Could not read backup file — invalid JSON", 4000);
              }
            };
            reader.readAsText(file);
          }
