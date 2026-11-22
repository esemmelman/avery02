import { assets } from "./assets.js";
import { vowels } from "./vowels.js";

const ids = new Set(vowels.map(([id]) => id));
const limit = 8 * 1024 * 1024;
const audioTypes = new Set(["audio/mp4", "audio/m4a", "audio/webm", "audio/ogg"]);

async function recordingsStore(env, user) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(user));
  const owner = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return (id, options = {}, copy = false) => {
    const url = new URL(env.SUPABASE_RECORDINGS_URL);
    url.searchParams.set("owner", owner);
    if (id) url.searchParams.set("vowel", id);
    if (copy) url.searchParams.set("copy", "1");
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${env.SUPABASE_RECORDINGS_TOKEN}`);
    return fetch(url, { ...options, headers, redirect: "error" });
  };
}

async function copyLegacyRecordings(bucket, store, prefix, legacyIds) {
  for (const id of legacyIds) {
    const object = await bucket.get(prefix + id);
    if (!object) continue;
    const response = await store(id, {
      method: "PUT",
      headers: { "Content-Type": object.httpMetadata.contentType },
      body: await object.arrayBuffer(),
    }, true);
    if (!response.ok && response.status !== 409) {
      console.error("Could not copy a legacy vowel recording", response.status);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
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
    const store = await recordingsStore(env, user);
    if (!id && request.method === "GET") {
      const [response, { objects }] = await Promise.all([store(), env.BUCKET.list({ prefix })]);
      if (!response.ok) return new Response("Storage unavailable", { status: 502, headers });
      const saved = new Set((await response.json()).filter((name) => ids.has(name)));
      const legacy = objects.map(({ key }) => key.slice(prefix.length))
        .filter((name) => ids.has(name) && !saved.has(name));
      if (legacy.length) {
        ctx.waitUntil(copyLegacyRecordings(env.BUCKET, store, prefix, legacy));
      }
      return Response.json([...saved, ...legacy], { headers });
    }

    if (!ids.has(id)) return new Response("Unknown vowel", { status: 404 });
    const key = prefix + id;
    if (request.method === "GET") {
      const range = request.headers.get("Range");
      const response = await store(id, { headers: range ? { Range: range } : {} });
      if (response.ok || response.status === 416) {
        for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]) {
          const value = response.headers.get(name);
          if (value) headers[name] = value;
        }
        return new Response(response.body, { status: response.status, headers });
      }
      if (response.status !== 404) return new Response("Storage unavailable", { status: 502, headers });
      const object = await env.BUCKET.get(key);
      if (!object) return new Response("No saved recording", { status: 404, headers });
      headers["Content-Type"] = object.httpMetadata.contentType;
      headers["Accept-Ranges"] = "bytes";
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
      const body = await request.arrayBuffer();
      if (!body.byteLength || body.byteLength > limit) {
        return new Response("Invalid recording size", { status: 413 });
      }
      const response = await store(id, { method: "PUT", body, headers: { "Content-Type": type } });
      if (!response.ok) return new Response("Storage unavailable", { status: 502, headers });
      return new Response(null, { status: 204, headers });
    }

    return new Response("Method not allowed", { status: 405 });
  },
};
