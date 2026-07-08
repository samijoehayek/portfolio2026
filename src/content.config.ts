// Lab — the blog / article collection. Astro 6 Content Layer + glob loader.
// Article bodies live in src/content/lab/*.md; cover art in src/assets/lab/*
// (so Astro's <Image> optimizes it). Consumed by src/pages/lab/*.
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const lab = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/lab" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      blurb: z.string(), // 1–2 sentence deck, shown on the card + article header
      date: z.coerce.date(),
      tags: z.array(z.string()), // e.g. BITCOIN · ETHEREUM · RUST · WEB3 · CRAFT
      cover: image(), // card + article hero art
      coverDepth: image().optional(), // grayscale depth map → enables the shader's 2.5D hover
      accent: z.string(), // per-article hex (mirrors projects.ts `accent`)
      featured: z.boolean().default(false), // the one big hero card on the index
      readingTime: z.number().optional(), // minutes; falls back to a body word-count estimate
      draft: z.boolean().default(false),
    }),
});

export const collections = { lab };
