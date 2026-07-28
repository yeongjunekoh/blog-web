import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  collectionSchemas,
  isCollectionName,
  type CollectionName,
} from "../../lib/schemas";

/** src/content/ 절대 경로 (cwd 무관하게 이 파일 위치 기준으로 고정) */
const CONTENT_ROOT = fileURLToPath(new URL("../../content/", import.meta.url));

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EXTS = ["md", "mdx"] as const;
export type Ext = (typeof EXTS)[number];

/** frontmatter 고정 필드 순서. 이 외의 알 수 없는 필드는 뒤에 원래대로 보존된다. */
const KNOWN_FIELD_ORDER = [
  "title",
  "description",
  "pubDate",
  "updatedDate",
  "tags",
  "heroImage",
  "draft",
  "category",
] as const;

export class StoreError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface EntrySummary {
  slug: string;
  ext: Ext;
  title: string;
  description: string;
  pubDate: string;
  draft: boolean;
  category?: string;
}

export interface EntryFile {
  slug: string;
  ext: Ext;
  frontmatter: Record<string, unknown>;
  body: string;
  mtimeMs: number;
}

// ---------- 경로 검증 ----------

export function assertCollection(value: string): CollectionName {
  if (!isCollectionName(value)) {
    throw new StoreError(404, `알 수 없는 컬렉션: ${value}`);
  }
  return value;
}

function assertSlug(slug: string): string {
  if (!SLUG_RE.test(slug)) {
    throw new StoreError(
      400,
      "slug는 kebab-case 영문 소문자/숫자만 허용됩니다 (예: my-first-post)",
    );
  }
  return slug;
}

function assertExt(ext: string): Ext {
  if (!(EXTS as readonly string[]).includes(ext)) {
    throw new StoreError(400, `확장자는 md 또는 mdx만 허용됩니다: ${ext}`);
  }
  return ext as Ext;
}

/** path traversal 방지: resolve 결과가 반드시 컬렉션 디렉터리 안이어야 한다. */
function resolveEntryPath(
  collection: CollectionName,
  slug: string,
  ext: Ext,
): string {
  const dir = path.resolve(CONTENT_ROOT, collection);
  const resolved = path.resolve(dir, `${slug}.${ext}`);
  if (!resolved.startsWith(dir + path.sep)) {
    throw new StoreError(400, "잘못된 경로입니다");
  }
  return resolved;
}

// ---------- frontmatter 파싱 / 직렬화 ----------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
  /** frontmatter 블록 + 본문 앞 공백까지의 원문 프리픽스 (바이트 보존용) */
  rawPrefix: string;
} {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: {}, body: raw, rawPrefix: "" };
  const parsed = parseYaml(match[1]);
  const frontmatter =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const afterFm = raw.slice(match[0].length);
  const blank = afterFm.match(/^\r?\n/)?.[0] ?? "";
  return {
    frontmatter,
    body: afterFm.slice(blank.length),
    rawPrefix: raw.slice(0, match[0].length) + blank,
  };
}

/**
 * frontmatter가 의미상 동일한지 비교 (무수정 저장 시 원문 서식 보존용).
 * draft 부재는 false, tags 부재는 []로 정규화해 비교한다.
 */
function frontmatterEquals(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const canon = (fm: Record<string, unknown>): string => {
    const norm: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(fm), "draft", "tags"]);
    for (const key of [...keys].sort()) {
      let value: unknown = fm[key];
      if (key === "draft") value = value === true;
      else if (key === "tags") value = Array.isArray(value) ? value : [];
      else value = normalizeFieldValue(key, value);
      if (value !== undefined) norm[key] = value;
    }
    return JSON.stringify(norm);
  };
  return canon(a) === canon(b);
}

/**
 * frontmatter를 고정 필드 순서로 재직렬화한다.
 * - pubDate/updatedDate는 문자열 "YYYY-MM-DD"로 기록 (Date 객체를 yaml에
 *   넘기면 타임스탬프화 + 타임존 시프트가 일어남)
 * - 알 수 없는 필드는 뒤쪽에 그대로 보존
 */
export function serializeEntry(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const ordered: Record<string, unknown> = {};
  for (const key of KNOWN_FIELD_ORDER) {
    const value = normalizeFieldValue(key, frontmatter[key]);
    if (value !== undefined) ordered[key] = value;
  }
  for (const [key, value] of Object.entries(frontmatter)) {
    if ((KNOWN_FIELD_ORDER as readonly string[]).includes(key)) continue;
    if (value !== undefined) ordered[key] = value;
  }
  const yamlText = stringifyYaml(ordered).trimEnd();
  const trimmedBody = body.replace(/\s+$/, "");
  return `---\n${yamlText}\n---\n\n${trimmedBody}\n`;
}

function normalizeFieldValue(key: string, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (key === "pubDate" || key === "updatedDate") {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
  }
  return value;
}

/** zod 검증. 실패 시 400 StoreError에 이슈 목록을 담는다. */
function validateFrontmatter(
  collection: CollectionName,
  frontmatter: Record<string, unknown>,
): void {
  const result = collectionSchemas[collection].safeParse(frontmatter);
  const issues = result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      }));
  // 스키마는 빌드와 동일하게 유지하되(z.string()은 빈 문자열 허용),
  // 편집기 저장 시에는 빈 title/description/category를 추가로 거부한다.
  for (const key of ["title", "description"] as const) {
    if (typeof frontmatter[key] !== "string" || !frontmatter[key].trim()) {
      issues.push({ path: key, message: `${key}은(는) 비울 수 없습니다` });
    }
  }
  if (collection === "knowledge") {
    const category = frontmatter.category;
    if (typeof category !== "string" || !category.trim()) {
      issues.push({ path: "category", message: "category는 비울 수 없습니다" });
    }
  }
  if (issues.length > 0) {
    throw new StoreError(400, "frontmatter 검증 실패", issues);
  }
}

// ---------- 파일 IO ----------

async function findEntryPath(
  collection: CollectionName,
  slug: string,
): Promise<{ filePath: string; ext: Ext } | null> {
  for (const ext of EXTS) {
    const filePath = resolveEntryPath(collection, slug, ext);
    try {
      await fs.access(filePath);
      return { filePath, ext };
    } catch {
      // 다음 확장자 시도
    }
  }
  return null;
}

export async function listEntries(
  collection: CollectionName,
): Promise<EntrySummary[]> {
  const dir = path.resolve(CONTENT_ROOT, collection);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return []; // 디렉터리가 아직 없으면 빈 목록
  }
  const entries: EntrySummary[] = [];
  for (const file of files) {
    const match = file.match(/^(.+)\.(md|mdx)$/);
    if (!match) continue;
    const [, slug, ext] = match;
    let raw: string;
    try {
      raw = await fs.readFile(path.join(dir, file), "utf-8");
    } catch {
      continue;
    }
    let frontmatter: Record<string, unknown> = {};
    try {
      frontmatter = splitFrontmatter(raw).frontmatter;
    } catch {
      // 파싱 불가 파일도 목록에는 노출 (제목 없이)
    }
    entries.push({
      slug,
      ext: ext as Ext,
      title: String(frontmatter.title ?? "(제목 없음)"),
      description: String(frontmatter.description ?? ""),
      pubDate: toDateString(frontmatter.pubDate),
      draft: frontmatter.draft === true,
      ...(typeof frontmatter.category === "string"
        ? { category: frontmatter.category }
        : {}),
    });
  }
  return entries.sort((a, b) => b.pubDate.localeCompare(a.pubDate));
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "");
}

export async function readEntry(
  collection: CollectionName,
  slugInput: string,
): Promise<EntryFile> {
  const slug = assertSlug(slugInput);
  const found = await findEntryPath(collection, slug);
  if (!found) throw new StoreError(404, `글을 찾을 수 없습니다: ${slug}`);
  const raw = await fs.readFile(found.filePath, "utf-8");
  const stat = await fs.stat(found.filePath);
  const { frontmatter, body } = splitFrontmatter(raw);
  return { slug, ext: found.ext, frontmatter, body, mtimeMs: stat.mtimeMs };
}

export async function createEntry(
  collection: CollectionName,
  input: {
    slug: string;
    ext: string;
    title: string;
    description: string;
    category?: string;
  },
): Promise<{ slug: string; ext: Ext }> {
  const slug = assertSlug(String(input.slug ?? ""));
  const ext = assertExt(String(input.ext ?? "md"));
  if (await findEntryPath(collection, slug)) {
    throw new StoreError(409, `이미 존재하는 slug입니다: ${slug}`);
  }
  const frontmatter: Record<string, unknown> = {
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    pubDate: new Date().toISOString().slice(0, 10),
    tags: [],
    draft: true,
    ...(collection === "knowledge"
      ? { category: String(input.category ?? "").trim() }
      : {}),
  };
  validateFrontmatter(collection, frontmatter);
  const filePath = resolveEntryPath(collection, slug, ext);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    serializeEntry(frontmatter, "여기에 본문을 작성하세요."),
    { encoding: "utf-8", flag: "wx" }, // 존재 시 실패 (경합 대비)
  );
  return { slug, ext };
}

export async function updateEntry(
  collection: CollectionName,
  slugInput: string,
  input: {
    frontmatter: Record<string, unknown>;
    body: string;
    baseMtimeMs?: number;
  },
): Promise<{ mtimeMs: number }> {
  const slug = assertSlug(slugInput);
  const found = await findEntryPath(collection, slug);
  if (!found) throw new StoreError(404, `글을 찾을 수 없습니다: ${slug}`);

  const stat = await fs.stat(found.filePath);
  if (
    typeof input.baseMtimeMs === "number" &&
    Math.abs(stat.mtimeMs - input.baseMtimeMs) > 0.5
  ) {
    throw new StoreError(
      409,
      "파일이 외부에서 수정되었습니다. 새로고침 후 다시 시도하세요.",
    );
  }

  // 알 수 없는 frontmatter 필드 보존: 디스크의 기존 필드 위에 폼 값을 merge
  const { frontmatter: existing, rawPrefix } = splitFrontmatter(
    await fs.readFile(found.filePath, "utf-8"),
  );
  const incoming =
    input.frontmatter && typeof input.frontmatter === "object"
      ? input.frontmatter
      : {};
  const merged: Record<string, unknown> = { ...existing };
  for (const key of KNOWN_FIELD_ORDER) {
    if (key in incoming) {
      const value = normalizeFieldValue(key, incoming[key]);
      if (value === undefined) delete merged[key];
      else merged[key] = value;
    }
  }

  validateFrontmatter(collection, merged);
  // frontmatter가 의미상 그대로면 원문 서식(따옴표/배열 표기 등)을 바이트
  // 단위로 보존한다 — "무수정 저장 diff 0" 보장의 일부.
  const body = String(input.body ?? "");
  const content =
    rawPrefix && frontmatterEquals(existing, merged)
      ? rawPrefix + body.replace(/\s+$/, "") + "\n"
      : serializeEntry(merged, body);
  await fs.writeFile(found.filePath, content, "utf-8");
  const newStat = await fs.stat(found.filePath);
  return { mtimeMs: newStat.mtimeMs };
}

export async function deleteEntry(
  collection: CollectionName,
  slugInput: string,
): Promise<void> {
  const slug = assertSlug(slugInput);
  const found = await findEntryPath(collection, slug);
  if (!found) throw new StoreError(404, `글을 찾을 수 없습니다: ${slug}`);
  await fs.unlink(found.filePath);
}
