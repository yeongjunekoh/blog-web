import type { APIRoute } from "astro";
import { parse } from "yaml";
import aboutRaw from "../data/about.yaml?raw";
import resumeRaw from "../data/resume.yaml?raw";
import { AUTHOR_NAME, SITE_URL, GITHUB_URL } from "../consts";

interface About {
  tagline: string;
  story: string[];
  principles: {
    title: string;
    body: string;
    links?: { title: string; href: string }[];
  }[];
  now: string[];
}

interface ResumeContact {
  contact: { email: string; github: string; location?: string };
}

/** /about 페이지의 .md 사본 — AI 크롤러/독자가 그대로 읽을 수 있는 형태. */
export const GET: APIRoute = () => {
  const about = parse(aboutRaw) as About;
  const resume = parse(resumeRaw) as ResumeContact;
  const canonical = new URL("/about/", SITE_URL).href;

  const lines: string[] = [
    "---",
    `title: "소개"`,
    `description: "${AUTHOR_NAME}의 소개. 걸어온 길, 일하는 원칙, 지금 하고 있는 고민."`,
    `canonical: ${canonical}`,
    "---",
    "",
    `# ${AUTHOR_NAME} — ${about.tagline}`,
    "",
    "## 걸어온 길",
    "",
    ...about.story.flatMap((p) => [p, ""]),
    "## 일하는 원칙",
    "",
    ...about.principles.flatMap((principle) => {
      const block = [`### ${principle.title}`, "", principle.body, ""];
      if (principle.links && principle.links.length > 0) {
        block.push(
          `관련 글 — ${principle.links
            .map((l) => `[${l.title}](${new URL(l.href, SITE_URL).href})`)
            .join(" · ")}`,
          "",
        );
      }
      return block;
    }),
    "## 지금은",
    "",
    ...about.now.flatMap((p) => [p, ""]),
    "## 연락",
    "",
    `- 이메일: ${resume.contact.email}`,
    `- GitHub: ${resume.contact.github}`,
    `- 이력서: ${new URL("/resume/", SITE_URL).href}`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
