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
  // The deploy workflow sets BUILD_VERSION to the GitHub Actions run
  // number, which increases by one on every push to main — giving each
  // deployed build a distinct, ever-incrementing version shown in the UI.
  // Falls back to "dev" for local builds/preview where it isn't set.
  define: {
    __BUILD_VERSION__: JSON.stringify(process.env.BUILD_VERSION || "dev"),
  },
});
