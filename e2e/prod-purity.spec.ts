import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 프로덕션 순수성 검증: `pnpm build` 산출물(dist/)에 dev 편집기의 흔적이
 * 단 하나도 없어야 한다 ("배포 환경에서는 조회만 가능"의 구조적 보장).
 * 겸사겸사 비공개 글(visibility: private)과 폐기 별칭(draft: true) 글이
 * dist에서 완전히 제외되는지도 확인한다.
 */

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const CONTENT_BLOG = path.join(ROOT, "src", "content", "blog");

/** 비공개 처리되어야 하는 임시 글 2종: 정식 표기 + 폐기 별칭(회귀 검증) */
const PRIVATE_POSTS = [
  {
    slug: "e2e-tmp-private-purity",
    token: "e2e-비공개-본문-토큰",
    fmLine: "visibility: private",
    label: "visibility: private",
  },
  {
    slug: "e2e-tmp-draft-alias-purity",
    token: "e2e-draft별칭-본문-토큰",
    fmLine: "draft: true",
    label: "폐기 별칭 draft: true",
  },
] as const;

/** 텍스트로 검사할 확장자 (바이너리는 스킵) */
const TEXT_EXTS = new Set([
  ".html", ".xml", ".txt", ".js", ".mjs", ".css", ".json", ".svg", ".map",
]);

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function runBuild(): void {
  try {
    execSync("pnpm build", { cwd: ROOT, stdio: "pipe", timeout: 240_000 });
  } catch (error) {
    // 콘텐츠 마이그레이션 병행 중이라 일시적 스키마 오류일 수 있음 — 1회 재시도
    console.warn("[prod-purity] build 실패, 10초 후 재시도합니다");
    execSync("sleep 10");
    execSync("pnpm build", { cwd: ROOT, stdio: "pipe", timeout: 240_000 });
  }
}

test("빌드 산출물에 편집기 흔적이 없고 비공개 글이 제외된다 (draft 별칭 포함)", async () => {
  // 비공개 임시 글 2종을 만들어 두고 빌드 (제외 검증 겸용)
  fs.mkdirSync(CONTENT_BLOG, { recursive: true });
  for (const post of PRIVATE_POSTS) {
    fs.writeFileSync(
      path.join(CONTENT_BLOG, `${post.slug}.md`),
      [
        "---",
        `title: "e2e 순수성 검증 (${post.label})"`,
        "description: 프로덕션 빌드에서 제외되어야 하는 비공개 글",
        "pubDate: 2026-07-28",
        "tags: []",
        post.fmLine,
        "---",
        "",
        `이 본문은 dist 어디에도 나타나면 안 된다: ${post.token}`,
        "",
      ].join("\n"),
    );
  }

  try {
    runBuild();

    // 1) /_editor 라우트가 아예 빌드되지 않음
    expect(fs.existsSync(path.join(DIST, "_editor"))).toBe(false);

    // 2) dist 전체 텍스트 파일에 "_editor"/"dev-editor" 문자열 0건
    //    ("_editor" 검사가 "dev-editor"도 포함하지만 명시적으로 둘 다 확인)
    const offenders: string[] = [];
    let scanned = 0;
    for (const file of walk(DIST)) {
      if (!TEXT_EXTS.has(path.extname(file))) continue;
      scanned += 1;
      const text = fs.readFileSync(file, "utf-8");
      if (text.includes("_editor") || text.includes("dev-editor")) {
        offenders.push(path.relative(DIST, file));
      }
    }
    expect(scanned).toBeGreaterThan(0);
    expect(offenders, "편집기 흔적이 발견된 파일").toEqual([]);

    // 3) sitemap에 _editor 미포함 (2에서 커버되지만 존재 자체도 확인)
    const sitemapIndex = path.join(DIST, "sitemap-index.xml");
    expect(fs.existsSync(sitemapIndex)).toBe(true);

    // 4) 비공개 글(정식 표기 + 폐기 별칭)은 페이지/본문 어디에도 없음
    //    (HTML/RSS/sitemap/llms.txt 등 dist의 모든 텍스트 파일 검사)
    for (const post of PRIVATE_POSTS) {
      expect(
        fs.existsSync(path.join(DIST, "blog", post.slug)),
        `${post.label} 글의 페이지가 빌드됨`,
      ).toBe(false);
      const privateOffenders: string[] = [];
      for (const file of walk(DIST)) {
        if (!TEXT_EXTS.has(path.extname(file))) continue;
        if (fs.readFileSync(file, "utf-8").includes(post.token)) {
          privateOffenders.push(path.relative(DIST, file));
        }
      }
      expect(
        privateOffenders,
        `${post.label} 본문이 노출된 파일`,
      ).toEqual([]);
    }
  } finally {
    for (const post of PRIVATE_POSTS) {
      fs.rmSync(path.join(CONTENT_BLOG, `${post.slug}.md`), { force: true });
    }
  }
});
