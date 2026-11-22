import { assets } from "./assets.js";
import { vowels } from "./vowels.js";

const ids = new Set(vowels.map(([id]) => id));
const limit = 8 * 1024 * 1024;
const audioTypes = new Set(["audio/mp4", "audio/m4a", "audio/webm", "audio/ogg"]);

export default {
  async fetch(request, env) {
    const { pathname, origin } = new URL(request.url);
    const asset = Object.hasOwn(assets, pathname) ? assets[pathname] : undefined;
    if (asset && request.method === "GET") {
      return new Response(asset.body, { headers: { "Content-Type": asset.type } });
    }

    const match = /^\/api\/audio(?:\/([a-z-]+))?$/.exec(pathname);
    if (!match) return new Response("Not found", { status: 404 });
    const user = request.headers.get("oai-authenticated-user-id");
    if (!user) return new Response("Sign in to sync recordings", { status: 401 });

    const [, id] = match;
    const prefix = `recordings/${encodeURIComponent(user)}/`;
    const headers = { "Cache-Control": "private, no-store" };
    if (!id && request.method === "GET") {
      const { objects } = await env.BUCKET.list({ prefix });
      return Response.json(objects.map(({ key }) => key.slice(prefix.length)), { headers });
    }

    if (!ids.has(id)) return new Response("Unknown vowel", { status: 404 });
    const key = prefix + id;
    if (request.method === "GET") {
      const object = await env.BUCKET.get(key);
      if (!object) return new Response("No saved recording", { status: 404, headers });
      headers["Content-Type"] = object.httpMetadata.contentType;
      headers["Accept-Ranges"] = "bytes";
      const range = request.headers.get("Range");
      if (range) {
        const bounds = /^bytes=(\d+)-(\d*)$/.exec(range);
        const start = Number(bounds?.[1]);
        const end = bounds?.[2] ? Math.min(Number(bounds[2]), object.size - 1) : object.size - 1;
        if (!bounds || start >= object.size || end < start) {
          await object.body.cancel();
          return new Response(null, {
            status: 416,
            headers: { ...headers, "Content-Range": `bytes */${object.size}` },
          });
        }
        const bytes = await object.arrayBuffer();
        headers["Content-Range"] = `bytes ${start}-${end}/${object.size}`;
        headers["Content-Length"] = String(end - start + 1);
        return new Response(bytes.slice(start, end + 1), { status: 206, headers });
      }
      return new Response(object.body, {
        headers: { ...headers, "Content-Length": String(object.size) },
      });
    }

    if (request.method === "PUT") {
      if (request.headers.get("Origin") !== origin) return new Response("Forbidden", { status: 403 });
      const type = request.headers.get("Content-Type")?.split(";")[0];
      if (!audioTypes.has(type)) return new Response("Unsupported audio format", { status: 415 });
      const length = Number(request.headers.get("Content-Length"));
      if (!Number.isSafeInteger(length) || length < 1 || length > limit) {
        return new Response("Invalid recording size", { status: 413 });
      }
      await env.BUCKET.put(key, request.body, { httpMetadata: { contentType: type } });
      return new Response(null, { status: 204, headers });
    }

    return new Response("Method not allowed", { status: 405 });
  },
};
