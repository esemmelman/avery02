import { timingSafeEqual } from "node:crypto";

const tokenHash = "__RECORDINGS_TOKEN_SHA256__";
const bucket = "avery02-vowel-recordings";
const storage = Deno.env.get("SUPABASE_URL") + "/storage/v1";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const types = new Set(["audio/mp4", "audio/m4a", "audio/webm", "audio/ogg"]);

Deno.serve(async (request) => {
  const token = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return new Response(null, { status: 401 });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const expected = Uint8Array.from(tokenHash.match(/../g)!, (pair) => parseInt(pair, 16));
  if (!timingSafeEqual(new Uint8Array(digest), expected)) return new Response(null, { status: 401 });

  const url = new URL(request.url);
  const owner = url.searchParams.get("owner") || "";
  const vowel = url.searchParams.get("vowel") || "";
  if (!/^[a-f0-9]{64}$/.test(owner) || (vowel && !/^[a-z-]{1,20}$/.test(vowel))) {
    return new Response(null, { status: 400 });
  }

  const headers = new Headers({ Authorization: `Bearer ${key}` });
  const object = `${bucket}/${owner}/${vowel}`;
  if (request.method === "GET" && !vowel) {
    headers.set("Content-Type", "application/json");
    const response = await fetch(`${storage}/object/list/${bucket}`, {
      method: "POST", headers, body: JSON.stringify({ prefix: owner, limit: 100 }),
    });
    if (!response.ok) return new Response(null, { status: 502 });
    const objects: { name: string; id: string | null }[] = await response.json();
    return Response.json(objects.filter(({ id }) => id).map(({ name }) => name));
  }

  if (request.method === "GET") {
    const range = request.headers.get("Range");
    if (range) headers.set("Range", range);
    const response = await fetch(`${storage}/object/authenticated/${object}`, { headers });
    if (!response.ok && response.status !== 416) {
      const error = await response.json().catch(() => null);
      const missing = response.status === 404 || Number(error?.statusCode) === 404;
      return new Response(null, { status: missing ? 404 : 502 });
    }
    const output = new Headers({ "Cache-Control": "private, no-store" });
    for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]) {
      const value = response.headers.get(name);
      if (value) output.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers: output });
  }

  if (request.method === "PUT" && vowel) {
    const type = request.headers.get("Content-Type") || "";
    if (!types.has(type)) return new Response(null, { status: 415 });
    const body = await request.arrayBuffer();
    if (!body.byteLength || body.byteLength > 8 * 1024 * 1024) {
      return new Response(null, { status: 413 });
    }
    headers.set("Content-Type", type);
    headers.set("Cache-Control", "0");
    const copy = url.searchParams.get("copy") === "1";
    headers.set("x-upsert", copy ? "false" : "true");
    const response = await fetch(`${storage}/object/${object}`, { method: "POST", headers, body });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      if (copy && (response.status === 409 || Number(error?.statusCode) === 409)) {
        return new Response(null, { status: 409 });
      }
      return new Response(null, { status: 502 });
    }
    await response.body?.cancel();
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 405 });
});
