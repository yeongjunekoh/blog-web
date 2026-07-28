import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { SITE_TITLE, SITE_URL } from "../consts";

// satori는 woff2를 지원하지 않으므로 OTF를 사용한다 (한글 글리프 포함 전체 폰트).
const fontDir = path.resolve(process.cwd(), "src/assets/fonts");
const pretendardBold = fs.readFileSync(path.join(fontDir, "Pretendard-Bold.otf"));
const pretendardRegular = fs.readFileSync(
  path.join(fontDir, "Pretendard-Regular.otf"),
);

// 브랜드 마크: 원본 색상(흰 채움 + 검은 윤곽선) 그대로의 크롭 PNG를 data URI로 임베드한다.
// 색 반전 금지 — 다크 배경 위에서 흰 실루엣이 도드라지는 것이 의도된 디자인이다.
// (인코딩은 글마다 반복되지 않도록 모듈 최상위에서 1회만.)
const markPng = fs.readFileSync(path.resolve(process.cwd(), "src/assets/og-mark.png"));
const MARK_URI = `data:image/png;base64,${markPng.toString("base64")}`;

// 마크는 우하단 고정(right:40, bottom:0). 텍스트 블록은 마크 왼쪽 경계(x=872)를
// 침범하지 않도록 TEXT_MAX_WIDTH로 잘라낸다. (padding-left 80 + 760 = 840)
const MARK_W = 288;
const MARK_H = 432;
const TEXT_MAX_WIDTH = "760px";

const ACCENT = "#2dd4bf";
const hostname = new URL(SITE_URL).hostname;

interface OgOptions {
  title: string;
  subtitle?: string;
  date?: Date;
}

/** 1200x630 OG 이미지 PNG 버퍼 생성 */
export async function renderOgImage({
  title,
  subtitle,
  date,
}: OgOptions): Promise<Uint8Array> {
  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          padding: "72px 80px",
          fontFamily: "Pretendard",
          borderTop: `16px solid ${ACCENT}`,
        },
        children: [
          {
            type: "img",
            props: {
              src: MARK_URI,
              // satori가 preserveAspectRatio="none"을 붙이므로 에셋 원본 비율(304:456 = 2:3)을
              // 정확히 지켜야 한다. 288x432는 2:3의 정확한 배수.
              width: MARK_W,
              height: MARK_H,
              style: {
                position: "absolute",
                right: "40px",
                bottom: "0px",
                opacity: 1,
              },
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "28px",
                marginTop: "24px",
              },
              children: [
                subtitle
                  ? {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "30px",
                          fontWeight: 400,
                          color: ACCENT,
                        },
                        children: subtitle,
                      },
                    }
                  : null,
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "68px",
                      fontWeight: 700,
                      lineHeight: 1.25,
                      letterSpacing: "-0.02em",
                      wordBreak: "keep-all",
                      // 우측 브랜드 마크 영역을 침범하지 않도록 제목 폭을 제한한다.
                      maxWidth: TEXT_MAX_WIDTH,
                    },
                    children: title,
                  },
                },
              ].filter(Boolean),
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "28px",
                color: "#a3a3a3",
                // 푸터도 마크 아래를 통과하지 않도록 폭을 제한한다.
                // (제한하지 않으면 호스트명이 인물 다리 선과 겹쳐 읽기 어려워진다.)
                maxWidth: TEXT_MAX_WIDTH,
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: { fontWeight: 700, color: "#fafafa" },
                    children: SITE_TITLE,
                  },
                },
                {
                  type: "div",
                  props: {
                    children: date
                      ? `${hostname} · ${date.toISOString().slice(0, 10)}`
                      : hostname,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Pretendard",
          data: pretendardBold,
          weight: 700,
          style: "normal",
        },
        {
          name: "Pretendard",
          data: pretendardRegular,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return resvg.render().asPng();
}
