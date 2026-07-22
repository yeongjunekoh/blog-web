import { getCollection, type CollectionEntry } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;
export type KnowledgeEntry = CollectionEntry<"knowledge">;
export type AnyEntry = BlogEntry | KnowledgeEntry;

/** 프로덕션 빌드에서는 draft: true 글을 어디에도 노출하지 않는다. */
function isPublished({ data }: { data: { draft: boolean } }): boolean {
  return import.meta.env.PROD ? data.draft !== true : true;
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
