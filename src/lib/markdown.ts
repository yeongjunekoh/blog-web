import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { stringify } from "yaml";
import type { AnyEntry } from "./content";

const md = new MarkdownIt({ html: true, linkify: true });

/**
 * MDX 본문에서 import/export 구문과 JSX 컴포넌트 태그를 제거해
 * 순수 마크다운에 가까운 형태로 만든다. (RSS / llms-full.txt 용)
 */
export function stripMdx(body: string): string {
  return body
    .replace(/^\s*import\s+.+?from\s+["'].+?["'];?\s*$/gm, "")
    .replace(/^\s*export\s+(const|let|var|function|default)\s[\s\S]*?$/gm, "")
    .replace(/<\/?[A-Z][\w.]*(\s[^>]*)?\/?>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 마크다운 본문 → sanitize된 전문 HTML (RSS content용) */
export function renderMarkdownToHtml(body: string): string {
  const html = md.render(stripMdx(body));
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
      pre: ["class"],
    },
  });
}

/**
 * 콘텐츠 엔트리 → .md 사본 텍스트.
 * 정리된 frontmatter + 본문(MDX import/JSX 제거). AI 크롤러/독자가 그대로 읽을 수 있는 형태.
 */
export function toMarkdownCopy(entry: AnyEntry, canonicalUrl: string): string {
  const { title, description, pubDate, updatedDate, tags } = entry.data;
  const frontmatter: Record<string, unknown> = {
    title,
    description,
    pubDate: pubDate.toISOString().slice(0, 10),
  };
  if (updatedDate) {
    frontmatter.updatedDate = updatedDate.toISOString().slice(0, 10);
  }
  if ("category" in entry.data) {
    frontmatter.category = entry.data.category;
  }
  if (tags.length > 0) frontmatter.tags = tags;
  frontmatter.canonical = canonicalUrl;

  return `---\n${stringify(frontmatter).trim()}\n---\n\n# ${title}\n\n${stripMdx(entry.body ?? "")}\n`;
}
