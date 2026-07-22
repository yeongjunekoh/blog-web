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
