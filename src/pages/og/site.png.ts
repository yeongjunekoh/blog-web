import type { APIRoute } from "astro";
import { renderOgImage } from "../../lib/og";
import { SITE_DESCRIPTION } from "../../consts";

export const GET: APIRoute = async () => {
  const png = await renderOgImage({
    title: SITE_DESCRIPTION.split(".")[0] + ".",
    subtitle: "기록하는 사람",
  });
  return new Response(png, {
    headers: { "Content-Type": "image/png" },
  });
};
