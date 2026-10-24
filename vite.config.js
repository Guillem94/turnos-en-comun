import { defineConfig } from "vite";

const base = process.env.TURNOS_BASE_PATH || "/";
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))
  throw new Error(
    "TURNOS_BASE_PATH must be a root-relative path with a trailing slash",
  );

export default defineConfig({ base });
