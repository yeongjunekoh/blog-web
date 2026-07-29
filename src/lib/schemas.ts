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
  /** 공개 여부. `private`면 프로덕션 빌드에서 완전히 제외된다 (dev에서는 보임). */
  visibility: z.enum(["public", "private"]).default("public"),
  /**
   * @deprecated `visibility`로 대체된 폐기 별칭.
   * 스키마에서 제거하면 옛 표기(`draft: true`)가 남은 파일에서 이 필드가
   * 조용히 무시되어 비공개 글이 공개되는 사고가 나므로, 파싱은 계속
   * 받아들이고 발행 판정(`isPublished`)에서 비공개로 처리한다.
   * 신규 작성 경로(dev 편집기)는 visibility만 쓴다.
   */
  draft: z.boolean().optional(),
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
