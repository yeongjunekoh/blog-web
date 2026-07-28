// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { SITE_URL } from "./src/consts.ts";
import devEditor from "./src/dev-editor/integration.ts";

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  // devEditor는 내부에서 command==='dev'일 때만 라우트를 주입한다 (빌드 무영향)
  integrations: [mdx(), react(), sitemap(), devEditor()],
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
