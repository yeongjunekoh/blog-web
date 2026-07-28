import type { APIRoute } from "astro";
import { guardRequest, jsonResponse } from "../lib/guard";
import {
  assertCollection,
  deleteEntry,
  readEntry,
  StoreError,
  updateEntry,
} from "../lib/store";
import { toErrorResponse } from "./collection";

export const prerender = false;

/** GET /_editor/api/[collection]/[slug] — 단건 조회 */
export const GET: APIRoute = async ({ params, request }) => {
  const denied = guardRequest(request);
  if (denied) return denied;
  try {
    const collection = assertCollection(params.collection ?? "");
    const entry = await readEntry(collection, params.slug ?? "");
    return jsonResponse(entry);
  } catch (error) {
    return toErrorResponse(error);
  }
};

/** PUT /_editor/api/[collection]/[slug] — 저장 */
export const PUT: APIRoute = async ({ params, request }) => {
  const denied = guardRequest(request);
  if (denied) return denied;
  try {
    const collection = assertCollection(params.collection ?? "");
    const body = await request.json().catch(() => {
      throw new StoreError(400, "잘못된 JSON body입니다");
    });
    const result = await updateEntry(collection, params.slug ?? "", body);
    return jsonResponse(result);
  } catch (error) {
    return toErrorResponse(error);
  }
};

/** DELETE /_editor/api/[collection]/[slug] — 삭제 */
export const DELETE: APIRoute = async ({ params, request }) => {
  const denied = guardRequest(request);
  if (denied) return denied;
  try {
    const collection = assertCollection(params.collection ?? "");
    await deleteEntry(collection, params.slug ?? "");
    return jsonResponse({ deleted: true });
  } catch (error) {
    return toErrorResponse(error);
  }
};
