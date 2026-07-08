import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { sortByDate, LAB_COPY } from "../../data/lab";

export async function GET(context: APIContext) {
  const items = (await getCollection("lab", ({ data }) => !data.draft)).sort(sortByDate);

  return rss({
    title: "The Lab — Samijoe Hayek",
    description: LAB_COPY.deck,
    site: context.site ?? "https://samijoehayek.com",
    items: items.map((e) => ({
      title: e.data.title,
      description: e.data.blurb,
      pubDate: e.data.date,
      link: `/lab/${e.id}/`,
      categories: e.data.tags,
    })),
    customData: `<language>en-us</language>`,
  });
}
