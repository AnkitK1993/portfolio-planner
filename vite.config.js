import { defineConfig } from "vite";

// Deployed as a GitHub Pages *project* site at
// https://ankitk1993.github.io/portfolio-planner/ — base must match the
// repo name so built asset URLs resolve under that subpath.
export default defineConfig({
  base: "/portfolio-planner/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
