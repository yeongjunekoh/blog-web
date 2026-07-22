import type { APIRoute } from "astro";
import {
  getPublishedBlog,
  getPublishedKnowledge,
  type AnyEntry,
} from "../../../lib/content";
import { renderOgImage } from "../../../lib/og";

export async function getStaticPaths() {
  const [posts, notes] = await Promise.all([
    getPublishedBlog(),
    getPublishedKnowledge(),
  ]);
  return [
    ...posts.map((entry) => ({
      params: { collection: "blog", slug: entry.id },
      props: { entry },
    })),
    ...notes.map((entry) => ({
      params: { collection: "knowledge", slug: entry.id },
      props: { entry },
    })),
  ];
}

export const GET: APIRoute<{ entry: AnyEntry }> = async ({ props }) => {
  const { entry } = props;
  const subtitle =
    "category" in entry.data ? `지식 · ${entry.data.category}` : "블로그";
  const png = await renderOgImage({
    title: entry.data.title,
    subtitle,
    date: entry.data.pubDate,
  });
  return new Response(png, {
    headers: { "Content-Type": "image/png" },
  });
};
