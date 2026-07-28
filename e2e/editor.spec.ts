import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * dev 편집기 e2e.
 *
 * 주의: 다른 작업(노션 마이그레이션)이 src/content/를 병행 수정하므로
 * 기존 콘텐츠 파일명에 절대 의존하지 않는다. 모든 테스트 파일은
 * `e2e-tmp-` prefix를 쓰고 afterAll에서 강제 클린업한다.
 */

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const CONTENT = path.join(ROOT, "src", "content");
const API_HEADERS = { "Content-Type": "application/json", "X-Dev-Editor": "1" };

function contentPath(collection: string, slug: string, ext = "md"): string {
  return path.join(CONTENT, collection, `${slug}.${ext}`);
}

function cleanupTmpFiles(): void {
  for (const collection of ["blog", "knowledge"]) {
    const dir = path.join(CONTENT, collection);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.startsWith("e2e-tmp-")) fs.rmSync(path.join(dir, file));
    }
  }
}

test.afterAll(() => {
  cleanupTmpFiles();
});

/** API로 임시 글을 만든다 (UI 생성 테스트가 아닌 테스트들의 셋업용) */
async function createViaApi(page: Page, collection: string, slug: string) {
  const res = await page.request.post(`/_editor/api/${collection}`, {
    headers: API_HEADERS,
    data: {
      slug,
      ext: "md",
      title: `e2e ${slug}`,
      description: "e2e 테스트 글",
      ...(collection === "knowledge" ? { category: "e2e" } : {}),
    },
  });
  expect(res.status(), `${slug} 생성`).toBe(201);
}

async function deleteViaApi(page: Page, collection: string, slug: string) {
  await page.request.delete(`/_editor/api/${collection}/${slug}`, {
    headers: API_HEADERS,
  });
}

/** 편집 화면에서 본문을 바꾸고 저장한 뒤 성공 상태를 기다린다 */
async function editBodyAndSave(page: Page, body: string) {
  await page.locator("#f-body").fill(body);
  await page.locator("#save").click();
  await expect(page.locator("#status")).toHaveAttribute("data-state", "saved");
}

test("목록: blog/knowledge 두 섹션이 렌더링된다", async ({ page }) => {
  await page.goto("/_editor");
  await expect(page.locator('[data-collection-section="blog"] h2')).toContainText(
    "블로그",
  );
  await expect(
    page.locator('[data-collection-section="knowledge"] h2'),
  ).toContainText("지식 노트");
});

test("생성: 새 글 폼 → 파일 생성 → 편집 화면 이동", async ({ page }) => {
  const slug = "e2e-tmp-post";
  await page.goto("/_editor");
  const section = page.locator('[data-collection-section="blog"]');
  await section.locator("summary").click();
  const form = section.locator("form[data-create]");
  await form.locator('input[name="slug"]').fill(slug);
  await form.locator('input[name="title"]').fill("e2e 생성 테스트");
  await form.locator('input[name="description"]').fill("생성 흐름 검증용");
  await form.locator('button[type="submit"]').click();

  await page.waitForURL(`**/_editor/blog/${slug}`);
  expect(fs.existsSync(contentPath("blog", slug))).toBe(true);
  const raw = fs.readFileSync(contentPath("blog", slug), "utf-8");
  expect(raw).toContain("title: e2e 생성 테스트");
  expect(raw).toContain("draft: true");
  // yaml 날짜 함정: pubDate는 YYYY-MM-DD 문자열 그대로 (타임스탬프화 금지)
  expect(raw).toMatch(/pubDate: \d{4}-\d{2}-\d{2}\n/);
});

test("수정+저장: 본문 수정 → 공개 페이지 HTML(JS 없이)에 반영", async ({
  page,
}) => {
  const slug = "e2e-tmp-edit";
  const token = `수정확인토큰-${Date.now()}`;
  await createViaApi(page, "blog", slug);

  await page.goto(`/_editor/blog/${slug}`);
  await editBodyAndSave(page, `저장 테스트 본문입니다.\n\n${token}`);

  // 파일 반영 확인
  expect(fs.readFileSync(contentPath("blog", slug), "utf-8")).toContain(token);

  // 공개 페이지의 "서버가 보낸 원본 HTML"에 본문이 포함 — JS 미실행 크롤러 관점
  // (= 이 블로그의 존재 이유 동시 검증). dev는 draft도 렌더한다.
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/blog/${slug}/`);
        return res.ok() ? await res.text() : "";
      },
      { timeout: 20_000, message: "공개 페이지 HTML에 본문 토큰 반영" },
    )
    .toContain(token);

  await deleteViaApi(page, "blog", slug);
});

test("검증: 빈 title 저장 시 400 + 인라인 에러", async ({ page }) => {
  const slug = "e2e-tmp-invalid";
  await createViaApi(page, "blog", slug);

  await page.goto(`/_editor/blog/${slug}`);
  const put400 = page.waitForResponse(
    (res) =>
      res.url().includes(`/_editor/api/blog/${slug}`) &&
      res.request().method() === "PUT",
  );
  await page.locator("#f-title").fill("");
  await page.locator("#save").click();

  expect((await put400).status()).toBe(400);
  await expect(page.locator("#status")).toHaveAttribute("data-state", "error");
  await expect(page.locator("#errors")).toBeVisible();
  await expect(page.locator("#errors")).toContainText("title");

  await deleteViaApi(page, "blog", slug);
});

test("삭제: 목록에서 confirm → 파일/API 404", async ({ page }) => {
  const slug = "e2e-tmp-delete";
  await createViaApi(page, "blog", slug);

  await page.goto("/_editor");
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .locator(`button[data-delete][data-slug="${slug}"]`)
    .click();
  await expect(
    page.locator(`button[data-delete][data-slug="${slug}"]`),
  ).toHaveCount(0);

  expect(fs.existsSync(contentPath("blog", slug))).toBe(false);
  const res = await page.request.get(`/_editor/api/blog/${slug}`);
  expect(res.status()).toBe(404);
});

test("보안: X-Dev-Editor 헤더 없는 변경 요청은 403", async ({ page }) => {
  const res = await page.request.post("/_editor/api/blog", {
    headers: { "Content-Type": "application/json" },
    data: { slug: "e2e-tmp-forbidden", ext: "md", title: "t", description: "d" },
  });
  expect(res.status()).toBe(403);
  expect(fs.existsSync(contentPath("blog", "e2e-tmp-forbidden"))).toBe(false);
});

test("함정1 실측: guard 없이(?noguard=1) 저장 시 편집 화면 full-reload 여부", async ({
  page,
}, testInfo) => {
  const slug = "e2e-tmp-noguard";
  await createViaApi(page, "blog", slug);

  await page.goto(`/_editor/blog/${slug}?noguard=1`);
  const tokenBefore = await page.evaluate(() =>
    (window as unknown as { __devEditorToken: string }).__devEditorToken,
  );
  await editBodyAndSave(page, `noguard 실측 본문 ${Date.now()}`);
  await page.waitForTimeout(3_000); // full-reload가 온다면 도착할 시간
  const tokenAfter = await page.evaluate(() =>
    (window as unknown as { __devEditorToken?: string }).__devEditorToken,
  );

  const reloaded = tokenBefore !== tokenAfter;
  const result = reloaded
    ? "full-reload 발생함 (guard 필요성 입증)"
    : "full-reload 발생하지 않음";
  testInfo.annotations.push({ type: "measurement", description: result });
  console.log(`[함정1 실측] guard 미적용 시: ${result}`);

  await deleteViaApi(page, "blog", slug);
});

test("함정1 방어: guard 활성 시 편집 화면은 유지되고 미리보기는 갱신된다", async ({
  page,
}) => {
  const slug = "e2e-tmp-guard";
  const token = `미리보기토큰-${Date.now()}`;
  await createViaApi(page, "blog", slug);

  await page.goto(`/_editor/blog/${slug}`);
  const tokenBefore = await page.evaluate(() =>
    (window as unknown as { __devEditorToken: string }).__devEditorToken,
  );
  await editBodyAndSave(page, `guard 검증 본문.\n\n${token}`);
  await page.waitForTimeout(3_000);

  // 편집 화면은 full-reload되지 않았다 (편집 상태 보호)
  const tokenAfter = await page.evaluate(() =>
    (window as unknown as { __devEditorToken?: string }).__devEditorToken,
  );
  expect(tokenAfter, "편집 화면이 reload되지 않아야 함").toBe(tokenBefore);

  // 미리보기 iframe에는 저장한 본문이 보인다 (필요 시 재시도 reload)
  await expect
    .poll(
      async () => {
        const text = await page.evaluate(() => {
          const frame = document.getElementById(
            "preview",
          ) as HTMLIFrameElement | null;
          return frame?.contentDocument?.body?.innerText ?? "";
        });
        if (!text.includes(token)) {
          await page.evaluate(() => {
            const frame = document.getElementById(
              "preview",
            ) as HTMLIFrameElement | null;
            frame?.contentWindow?.location.reload();
          });
        }
        return text;
      },
      { timeout: 20_000, message: "미리보기 iframe에 저장 본문 반영" },
    )
    .toContain(token);

  await deleteViaApi(page, "blog", slug);
});
