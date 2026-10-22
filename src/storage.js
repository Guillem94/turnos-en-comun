import { emptyState, validateBackup } from "./domain.js";
const key = (mode) => `turnos-en-comun:v1:${mode}`;
export function load(mode) {
  const raw = localStorage.getItem(key(mode));
  return raw ? validateBackup(JSON.parse(raw)) : emptyState();
}
export function persist(mode, state) {
  localStorage.setItem(key(mode), JSON.stringify(state));
}
export function download(name, content, type) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
