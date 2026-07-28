import type { APIRoute } from "astro";
import { guardRequest, jsonResponse } from "../lib/guard";
import { assertCollection, createEntry, listEntries, StoreError } from "../lib/store";

export const prerender = false;

/** GET /_editor/api/[collection] — 글 목록 */
export const GET: APIRoute = async ({ params, request }) => {
  const denied = guardRequest(request);
  if (denied) return denied;
  try {
    const collection = assertCollection(params.collection ?? "");
    return jsonResponse({ entries: await listEntries(collection) });
  } catch (error) {
    return toErrorResponse(error);
  }
};

/** POST /_editor/api/[collection] — 새 글 생성 */
export const POST: APIRoute = async ({ params, request }) => {
  const denied = guardRequest(request);
  if (denied) return denied;
  try {
    const collection = assertCollection(params.collection ?? "");
    const body = await request.json().catch(() => {
      throw new StoreError(400, "잘못된 JSON body입니다");
    });
    const created = await createEntry(collection, body);
    return jsonResponse(created, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
};

export function toErrorResponse(error: unknown): Response {
  if (error instanceof StoreError) {
    return jsonResponse(
      { error: error.message, ...(error.details ? { issues: error.details } : {}) },
      error.status,
    );
  }
  console.error("[dev-editor]", error);
  return jsonResponse({ error: "서버 오류" }, 500);
}
