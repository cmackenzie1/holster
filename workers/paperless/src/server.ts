import handler from "@tanstack/react-start/server-entry";
import { verifyCloudflareAccess } from "./utils/cloudflare-access";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Skip auth for static assets
    const isStaticAsset =
      url.pathname.startsWith("/_build/") ||
      url.pathname.startsWith("/assets/") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".map") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".woff") ||
      url.pathname.endsWith(".woff2");

    if (!isStaticAsset) {
      const result = await verifyCloudflareAccess(request);

      if (!result.valid) {
        console.log(
          JSON.stringify({
            event: "cloudflare_access_denied",
            path: url.pathname,
            error: result.error,
            timestamp: new Date().toISOString(),
          })
        );

        return new Response("Unauthorized", {
          status: 401,
          headers: {
            "Content-Type": "text/plain",
          },
        });
      }
    }

    return handler.fetch(request);
  },
};
