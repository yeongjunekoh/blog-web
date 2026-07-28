import type { AstroIntegration } from "astro";

/**
 * dev 전용 콘텐츠 편집기.
 *
 * `astro dev`에서만 /_editor 라우트를 주입한다. build/preview/sync에는
 * 아무것도 주입하지 않으므로 프로덕션 산출물(dist/)에 편집기 코드·라우트가
 * 존재할 수 없다 — "배포 환경에서는 조회만 가능"이 구조적으로 보장된다.
 *
 * 주의: `import.meta.env.DEV` 런타임 분기만으로는 코드가 빌드에 emit되므로
 * 불충분하다. 반드시 이 통합 레벨의 command 분기를 유지할 것.
 */
export default function devEditor(): AstroIntegration {
  return {
    name: "dev-editor",
    hooks: {
      "astro:config:setup": ({ command, config, injectRoute, logger }) => {
        if (command !== "dev") return;

        // `--host` 등으로 non-localhost 바인딩이 감지되면 편집기를 비활성화한다.
        // 편집기는 파일시스템에 쓰기 때문에 로컬 루프백에서만 열려야 한다.
        const host = config.server?.host;
        if (host === true || (typeof host === "string" && !isLoopback(host))) {
          logger.warn(
            `dev editor disabled: 서버가 non-localhost(${String(host)})에 바인딩되어 있습니다. --host 없이 실행하세요.`,
          );
          return;
        }

        const routes = [
          ["/_editor", "./src/dev-editor/pages/index.astro"],
          ["/_editor/[collection]/[slug]", "./src/dev-editor/pages/edit.astro"],
          ["/_editor/api/[collection]", "./src/dev-editor/api/collection.ts"],
          [
            "/_editor/api/[collection]/[slug]",
            "./src/dev-editor/api/entry.ts",
          ],
        ] as const;

        for (const [pattern, entrypoint] of routes) {
          injectRoute({ pattern, entrypoint, prerender: false });
        }
        logger.info("dev editor enabled at /_editor");
      },
    },
  };
}

function isLoopback(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}
