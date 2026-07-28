import { defineConfig } from "@playwright/test";

/**
 * e2e 프로젝트 2개:
 * - editor: dev 서버(4321)의 /_editor CRUD + 미리보기. 이미 떠 있는 dev 서버 재사용.
 * - prod-purity: pnpm build 산출물(dist/)에 편집기 흔적이 없는지 검증. 서버 불필요.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4321",
  },
  projects: [
    {
      name: "editor",
      testMatch: /editor\.spec\.ts/,
    },
    {
      name: "prod-purity",
      testMatch: /prod-purity\.spec\.ts/,
      timeout: 300_000,
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:4321",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
