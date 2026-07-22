import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getPublishedBlog, getPublishedKnowledge } from "../lib/content";
import { renderMarkdownToHtml } from "../lib/markdown";
import { SITE_TITLE, SITE_DESCRIPTION, SITE_URL } from "../consts";

export const GET: APIRoute = async () => {
  const [posts, notes] = await Promise.all([
    getPublishedBlog(),
    getPublishedKnowledge(),
  ]);

  const items = [
    ...posts.map((entry) => ({ entry, base: "blog" as const })),
    ...notes.map((entry) => ({ entry, base: "knowledge" as const })),
  ].sort((a, b) => b.entry.data.pubDate.valueOf() - a.entry.data.pubDate.valueOf());

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: SITE_URL,
    items: items.map(({ entry, base }) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.pubDate,
      link: `/${base}/${entry.id}/`,
      categories:
        "category" in entry.data
          ? [entry.data.category, ...entry.data.tags]
          : entry.data.tags,
      // 전문(full-text) 피드: 본문 전체 HTML 포함
      content: renderMarkdownToHtml(entry.body ?? ""),
    })),
    customData: `<language>ko</language>`,
  });
};
