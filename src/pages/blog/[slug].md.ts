import type { APIRoute } from "astro";
import { getPublishedBlog, type BlogEntry } from "../../lib/content";
import { toMarkdownCopy } from "../../lib/markdown";
import { SITE_URL } from "../../consts";

export async function getStaticPaths() {
  const posts = await getPublishedBlog();
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { entry: post },
  }));
}

export const GET: APIRoute<{ entry: BlogEntry }> = ({ props }) => {
  const canonical = new URL(`/blog/${props.entry.id}/`, SITE_URL).href;
  return new Response(toMarkdownCopy(props.entry, canonical), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
