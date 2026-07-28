import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 프로덕션 순수성 검증: `pnpm build` 산출물(dist/)에 dev 편집기의 흔적이
 * 단 하나도 없어야 한다 ("배포 환경에서는 조회만 가능"의 구조적 보장).
 * 겸사겸사 draft 글이 dist에서 완전히 제외되는지도 확인한다.
 */

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const DRAFT_SLUG = "e2e-tmp-draft-purity";
const DRAFT_FILE = path.join(ROOT, "src", "content", "blog", `${DRAFT_SLUG}.md`);

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

test("빌드 산출물에 편집기 흔적이 없고 draft가 제외된다", async () => {
  // draft 임시 글을 만들어 두고 빌드 (draft 제외 검증 겸용)
  fs.mkdirSync(path.dirname(DRAFT_FILE), { recursive: true });
  fs.writeFileSync(
    DRAFT_FILE,
    [
      "---",
      "title: e2e draft 순수성 검증",
      "description: 프로덕션 빌드에서 제외되어야 하는 draft 글",
      "pubDate: 2026-07-28",
      "tags: []",
      "draft: true",
      "---",
      "",
      "이 본문은 dist 어디에도 나타나면 안 된다: e2e-draft-본문-토큰",
      "",
    ].join("\n"),
  );

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

    // 4) draft 글은 페이지/본문 어디에도 없음
    expect(fs.existsSync(path.join(DIST, "blog", DRAFT_SLUG))).toBe(false);
    const draftOffenders: string[] = [];
    for (const file of walk(DIST)) {
      if (!TEXT_EXTS.has(path.extname(file))) continue;
      if (fs.readFileSync(file, "utf-8").includes("e2e-draft-본문-토큰")) {
        draftOffenders.push(path.relative(DIST, file));
      }
    }
    expect(draftOffenders, "draft 본문이 노출된 파일").toEqual([]);
  } finally {
    fs.rmSync(DRAFT_FILE, { force: true });
  }
});
