import type { APIRoute } from "astro";
import { SITE_URL } from "../consts";

// AI 크롤러를 명시적으로 허용한다 — 이 블로그의 존재 이유.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
  "Applebot-Extended",
];

export const GET: APIRoute = () => {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    ...AI_CRAWLERS.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", ""]),
    `Sitemap: ${new URL("/sitemap-index.xml", SITE_URL).href}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
