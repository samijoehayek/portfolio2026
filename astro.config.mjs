// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Canonical origin — powers absolute URLs for sitemap, RSS, canonical + OG tags.
  site: "https://samijoehayek.com",
  // Page transitions use native cross-document View Transitions (MPA), not the
  // SPA ClientRouter — see src/styles/global.css. Keeps every island script
  // re-running on each real navigation (no persisted state / WebGL leaks).
  integrations: [sitemap()],
  markdown: {
    // Dark, bluish syntax theme for Lab code blocks; the block background is
    // re-skinned to deep navy in the article prose CSS for brand cohesion.
    shikiConfig: {
      theme: "material-theme-palenight",
      wrap: false,
    },
  },
});
