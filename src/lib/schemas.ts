import { z } from "astro/zod";

/**
 * 콘텐츠 컬렉션 frontmatter 스키마의 단일 소스.
 * content.config.ts(빌드/콘텐츠 레이어)와 dev 편집기(저장 시 검증)가 공유한다.
 * `astro/zod`는 `astro:content`가 re-export하는 것과 동일한 zod 인스턴스다.
 */
export const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  heroImage: z.string().optional(),
  draft: z.boolean().default(false),
});

export const knowledgeSchema = blogSchema.extend({
  category: z.string(),
});

export const collectionSchemas = {
  blog: blogSchema,
  knowledge: knowledgeSchema,
} as const;

export type CollectionName = keyof typeof collectionSchemas;

export const COLLECTION_NAMES = Object.keys(
  collectionSchemas,
) as CollectionName[];

export function isCollectionName(value: string): value is CollectionName {
  return value in collectionSchemas;
}
