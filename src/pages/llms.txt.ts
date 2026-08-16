import type { APIRoute } from "astro";
import { getPublishedBlog, getPublishedKnowledge } from "../lib/content";
import { SITE_TITLE, SITE_DESCRIPTION, SITE_URL } from "../consts";

export const GET: APIRoute = async () => {
  const [posts, notes] = await Promise.all([
    getPublishedBlog(),
    getPublishedKnowledge(),
  ]);

  const lines: string[] = [
    `# ${SITE_TITLE}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "이 사이트의 모든 글은 마크다운 원본(.md)을 함께 제공합니다.",
    `전체 본문이 포함된 단일 파일은 ${new URL("/llms-full.txt", SITE_URL).href} 에 있습니다.`,
    "",
    "## 블로그",
    "",
    ...posts.map(
      (post) =>
        `- [${post.data.title}](${new URL(`/blog/${post.id}.md`, SITE_URL).href}): ${post.data.description}`,
    ),
    "",
    "## 지식 노트",
    "",
    ...notes.map(
      (note) =>
        `- [${note.data.title}](${new URL(`/knowledge/${note.id}.md`, SITE_URL).href}): [${note.data.category}] ${note.data.description}`,
    ),
    "",
    "## 기타",
    "",
    `- [소개](${new URL("/about.md", SITE_URL).href}): ${SITE_TITLE}의 소개 — 걸어온 길, 일하는 원칙, 지금 하고 있는 고민`,
    `- [이력서](${new URL("/resume/", SITE_URL).href}): ${SITE_TITLE}의 이력서`,
    `- [RSS (전문 피드)](${new URL("/rss.xml", SITE_URL).href})`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
