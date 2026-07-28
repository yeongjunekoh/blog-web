const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * dev 편집기 API 요청 가드 (localhost dev라도 필수 — DNS rebinding /
 * 악성 웹페이지의 cross-site 요청으로부터 파일시스템 쓰기를 보호).
 *
 * - 요청 호스트가 loopback이 아니면 403
 * - Origin 헤더가 있으면 same-origin이어야 함
 * - Sec-Fetch-Site가 있으면 same-origin(또는 직접 진입 none)이어야 함
 * - 변경 요청(POST/PUT/DELETE)은 커스텀 헤더 `X-Dev-Editor: 1` 필수
 *   (단순 폼 제출/이미지 태그 등으로는 위조 불가능한 preflight 유발 헤더)
 *
 * 통과하면 null, 아니면 403 Response를 반환한다.
 */
export function guardRequest(request: Request): Response | null {
  const url = new URL(request.url);

  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    return forbidden("dev 편집기는 localhost에서만 사용할 수 있습니다");
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return forbidden("cross-origin 요청은 허용되지 않습니다");
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return forbidden("cross-site 요청은 허용되지 않습니다");
  }

  if (
    MUTATING_METHODS.has(request.method) &&
    request.headers.get("x-dev-editor") !== "1"
  ) {
    return forbidden("X-Dev-Editor 헤더가 필요합니다");
  }

  return null;
}

function forbidden(message: string): Response {
  return jsonResponse({ error: message }, 403);
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
