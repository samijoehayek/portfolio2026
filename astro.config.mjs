// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  // View Transitions / ClientRouter are enabled per-page via the Layout.
  markdown: {
    // Dark, bluish syntax theme for Lab code blocks; the block background is
    // re-skinned to deep navy in the article prose CSS for brand cohesion.
    shikiConfig: {
      theme: "material-theme-palenight",
      wrap: false,
    },
  },
});
