# blog-web — 고영준 개인 블로그

## 개요와 철학

- **Astro 5** 정적 사이트. 콘텐츠 원본은 마크다운 + git으로 소유하고, 완성된 HTML을 정적 서빙한다.
- **모든 본문은 JS 없이 순수 HTML로 렌더링된다.** view-source에 본문이 보여야 한다 (AI 크롤러는 JS를 실행하지 않는다). 이것이 이 블로그의 존재 이유다.
- 인터랙티브 요소(React, 추후 R3F 등)는 MDX 안에 `client:visible` 아일랜드로만 삽입한다. 본문 텍스트는 항상 정적으로 남긴다.
- 스택: Astro 5 + MDX + React + Tailwind CSS v4 + Pretendard. 디자인은 모노크롬 산세리프 미니멀, 포인트 컬러는 틸(`--accent`, `src/styles/global.css`).

## site URL 변경 지점

도메인 확정 시 **`src/consts.ts`의 `SITE_URL` 한 곳만 수정**하면 된다.
(sitemap, RSS, robots.txt, llms.txt, OG, JSON-LD, canonical 전부 여기서 파생됨)
현재 실제 배포 URL (Vercel production, main 브랜치 자동 배포): `https://blog-web-psi-six.vercel.app`

## 글 작성 방법

### 파일 위치와 컨벤션

| 종류 | 위치 | 확장자 |
|---|---|---|
| 블로그 글 | `src/content/blog/` | `.md` 또는 `.mdx` (React 아일랜드 필요 시만 mdx) |
| 지식 노트 | `src/content/knowledge/` | 동일 |

- **파일명 = URL slug. kebab-case 영문**으로 짓는다. 예: `why-i-built-this-blog.mdx` → `/blog/why-i-built-this-blog/`
- 블로그 vs 지식 구분: **흐름이 있는 생각/경험담은 블로그**, **주제별로 정리한 학습·참고 자료는 지식 노트**. 지식 노트는 `category`가 필수이며 목록에서 카테고리별로 묶인다.

### frontmatter 규칙

```yaml
---
title: "글 제목"
description: "목록/OG/llms.txt에 쓰이는 한두 문장 요약 (필수)"
pubDate: 2026-07-22
tags: ["태그1", "태그2"]      # 선택, 기본 []
draft: false                  # 선택, 기본 false
updatedDate: 2026-08-01       # 선택, 수정 시
category: "웹"                # knowledge 컬렉션만 필수
---
```

스키마 정의: `src/content.config.ts` (zod). 어기면 빌드가 실패한다.

### MDX 아일랜드 패턴

```mdx
import IslandDemo from "../../components/IslandDemo.tsx";

본문 텍스트 (정적 HTML로 렌더링됨)

<IslandDemo client:visible />
```

### draft 운용

- `draft: true`면 **프로덕션 빌드에서 완전히 제외**된다 (목록/상세/RSS/sitemap/llms.txt/OG 전부). `pnpm dev`에서는 보인다.
- 필터 로직: `src/lib/content.ts`의 `isPublished`. 새 목록/피드를 추가할 때 반드시 `getPublishedBlog()`/`getPublishedKnowledge()` 헬퍼를 쓸 것 (raw `getCollection` 금지).

## 발행 절차

1. 글 파일 작성 → `pnpm build`로 로컬 확인 (스키마 오류/렌더링 확인)
2. 커밋 → push = 배포 (Vercel이 main 브랜치를 자동 빌드)
3. 커밋 메시지 컨벤션: `post: 글 제목` (새 글), `edit: 글 제목` (수정), `feat:`/`fix:`/`chore:` (사이트 기능)

## AI 최적화 체크리스트 (새 기능/페이지 추가 시 지킬 것)

- [ ] 본문/핵심 콘텐츠는 JS 없이 정적 HTML로 렌더링되는가
- [ ] 새 콘텐츠 유형이라면 `.md` 사본 엔드포인트(`[slug].md.ts`)와 `llms.txt`/`llms-full.txt`에 포함했는가
- [ ] JSON-LD를 붙였는가 (상세: BlogPosting, 홈: Person — `src/layouts/PostLayout.astro` 참고)
- [ ] RSS(`src/pages/rss.xml.ts`)에 전문이 포함되는가
- [ ] draft 필터를 통과시켰는가 (`src/lib/content.ts` 헬퍼 사용)
- [ ] 페이지당 h1 하나, article/nav/main/time 등 시맨틱 요소 유지
- [ ] OG 이미지: 상세 페이지는 `/og/{collection}/{slug}.png` 자동 생성 (`src/lib/og.ts`, satori는 woff2 불가 — OTF 폰트 사용 중)

## 코드 구조

```
src/
  consts.ts            # SITE_URL 등 전역 상수 (단일 변경 지점)
  content.config.ts    # 콘텐츠 컬렉션 스키마 (glob loader)
  content/{blog,knowledge}/   # 글 원본
  data/resume.yaml     # 이력서 데이터 (본문 하드코딩 금지, 이 파일만 수정)
  lib/content.ts       # draft 필터 + 정렬 + 카테고리 그룹핑
  lib/markdown.ts      # .md 사본 / RSS 전문 렌더링 / MDX 스트립
  lib/og.ts            # satori OG 이미지 (Pretendard OTF)
  layouts/             # BaseLayout(head/SEO/JSON-LD), PostLayout
  components/          # Header, Footer, ThemeToggle, FormattedDate, IslandDemo(React)
  pages/               # 라우트 + 엔드포인트(llms.txt, rss.xml, robots.txt, og/*, *.md)
  styles/global.css    # Tailwind v4 (@theme), 포인트 컬러, 다크모드, shiki 듀얼 테마
  assets/fonts/        # Pretendard OTF (OG 전용; 웹폰트는 CDN)
```

- 다크모드: `html.dark` 클래스. FOUC 방지 인라인 스크립트는 `BaseLayout.astro` head에 있음. Tailwind `dark:` variant는 `@custom-variant`로 클래스 기반.
- 코드 하이라이팅: 내장 shiki 듀얼 테마 (github-light/github-dark), 다크 전환 CSS는 `global.css`.

## 자주 쓰는 명령

```bash
pnpm dev        # 개발 서버 (draft 글도 보임)
pnpm build      # 프로덕션 빌드 → dist/
pnpm preview    # 빌드 결과 로컬 서빙
```
