import type { APIRoute } from "astro";
import {
  getPublishedBlog,
  getPublishedKnowledge,
  type AnyEntry,
} from "../lib/content";
import { stripMdx } from "../lib/markdown";
import { SITE_TITLE, SITE_DESCRIPTION, SITE_URL } from "../consts";

function renderEntry(entry: AnyEntry, base: "blog" | "knowledge"): string {
  const { title, description, pubDate, tags } = entry.data;
  const category = "category" in entry.data ? entry.data.category : undefined;
  const meta = [
    `URL: ${new URL(`/${base}/${entry.id}/`, SITE_URL).href}`,
    `날짜: ${pubDate.toISOString().slice(0, 10)}`,
    category ? `카테고리: ${category}` : null,
    tags.length > 0 ? `태그: ${tags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `## ${title}\n\n${meta}\n\n${description}\n\n${stripMdx(entry.body ?? "")}`;
}

export const GET: APIRoute = async () => {
  const [posts, notes] = await Promise.all([
    getPublishedBlog(),
    getPublishedKnowledge(),
  ]);

  const sections = [
    `# ${SITE_TITLE}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "이 파일은 사이트의 모든 공개 글 전문을 담고 있습니다.",
    "",
    "# 블로그",
    "",
    ...posts.map((post) => renderEntry(post, "blog")),
    "",
    "# 지식 노트",
    "",
    ...notes.map((note) => renderEntry(note, "knowledge")),
    "",
  ];

  return new Response(sections.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
