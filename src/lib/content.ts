import { getCollection, type CollectionEntry } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;
export type KnowledgeEntry = CollectionEntry<"knowledge">;
export type AnyEntry = BlogEntry | KnowledgeEntry;

/**
 * 프로덕션 빌드에서는 비공개 글(visibility: private)을 어디에도 노출하지
 * 않는다. dev에서는 비공개 글도 보인다.
 * `draft: true`는 폐기 별칭 — 옛 표기가 남은 파일도 계속 비공개로 취급한다.
 */
function isPublished({
  data,
}: {
  data: { visibility: "public" | "private"; draft?: boolean };
}): boolean {
  if (!import.meta.env.PROD) return true;
  return data.visibility !== "private" && data.draft !== true;
}

function byDateDesc(a: AnyEntry, b: AnyEntry): number {
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

export async function getPublishedBlog(): Promise<BlogEntry[]> {
  const entries = await getCollection("blog", isPublished);
  return entries.sort(byDateDesc);
}

export async function getPublishedKnowledge(): Promise<KnowledgeEntry[]> {
  const entries = await getCollection("knowledge", isPublished);
  return entries.sort(byDateDesc);
}

/**
 * 목록에서 쓰는 대표 이미지. frontmatter `heroImage`가 있으면 그것,
 * 없으면 자동 생성 OG 카드로 폴백 — 모든 글에 대표 이미지가 반드시 존재한다.
 */
export function getHeroImage(entry: AnyEntry): string {
  return entry.data.heroImage ?? `/og/${entry.collection}/${entry.id}.png`;
}

/** 지식 노트를 카테고리별로 묶는다. 카테고리는 가나다순, 내부 글은 최신순. */
export function groupByCategory(
  entries: KnowledgeEntry[],
): Map<string, KnowledgeEntry[]> {
  const map = new Map<string, KnowledgeEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.data.category) ?? [];
    list.push(entry);
    map.set(entry.data.category, list);
  }
  return new Map(
    [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "ko")),
  );
}
