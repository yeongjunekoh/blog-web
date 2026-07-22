import type { APIRoute } from "astro";
import { getPublishedKnowledge, type KnowledgeEntry } from "../../lib/content";
import { toMarkdownCopy } from "../../lib/markdown";
import { SITE_URL } from "../../consts";

export async function getStaticPaths() {
  const notes = await getPublishedKnowledge();
  return notes.map((note) => ({
    params: { slug: note.id },
    props: { entry: note },
  }));
}

export const GET: APIRoute<{ entry: KnowledgeEntry }> = ({ props }) => {
  const canonical = new URL(`/knowledge/${props.entry.id}/`, SITE_URL).href;
  return new Response(toMarkdownCopy(props.entry, canonical), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
