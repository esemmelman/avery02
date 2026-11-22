import { timingSafeEqual } from "node:crypto";

const origin = "https://esemmelman.github.io";
const tokenHash = "__ACCESS_CODE_SHA256__";
const bucket = "avery02-vowel-recordings";
const prefix = "avery02";
const storage = Deno.env.get("SUPABASE_URL") + "/storage/v1";
const role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const types = new Set(["audio/mp4", "audio/m4a", "audio/webm", "audio/ogg"]);
const vowels = new Set(["patah", "qamatz", "segol", "tsere", "hiriq", "holam", "qubuts", "shuruk",
  "sheva", "hataf-segol", "hataf-patah", "hataf-qamatz", "qamatz-qatan"]);
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Cache-Control": "private, no-store",
  Vary: "Origin",
};

Deno.serve(async (request) => {
  const reply = (status: number) => new Response(null, { status, headers: cors });
  const caller = request.headers.get("Origin");
  if (caller && caller !== origin) return reply(403);
  if (request.method === "OPTIONS") return reply(204);

  const token = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return reply(401);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const expected = Uint8Array.from(tokenHash.match(/../g)!, (pair) => parseInt(pair, 16));
  if (!timingSafeEqual(new Uint8Array(digest), expected)) return reply(401);

  const query = new URL(request.url).searchParams;
  const vowel = query.get("vowel");
  const headers = new Headers({ Authorization: `Bearer ${role}` });

  if (!vowel && request.method === "GET") {
    headers.set("Content-Type", "application/json");
    const response = await fetch(`${storage}/object/list/${bucket}`, {
      method: "POST", headers, body: JSON.stringify({ prefix, limit: 100 }),
    });
    if (!response.ok) return reply(502);
    const objects: { name: string; id: string | null }[] = await response.json();
    return Response.json(objects.filter(({ id, name }) => id && vowels.has(name))
      .map(({ name }) => name), { headers: cors });
  }

  if (!vowel || !vowels.has(vowel)) return reply(404);
  const path = `${bucket}/${prefix}/${vowel}`;
  if (request.method === "GET") {
    const response = await fetch(`${storage}/object/authenticated/${path}`, { headers });
    if (!response.ok) return reply(response.status === 404 ? 404 : 502);
    return new Response(response.body, {
      headers: { ...cors, "Content-Type": response.headers.get("Content-Type") || "audio/mp4" },
    });
  }

  if (request.method === "PUT") {
    const type = request.headers.get("Content-Type")?.split(";")[0] || "";
    if (!types.has(type)) return reply(415);
    const body = await request.arrayBuffer();
    if (!body.byteLength || body.byteLength > 8 * 1024 * 1024) return reply(413);
    headers.set("Content-Type", type);
    const copy = query.get("copy") === "1";
    headers.set("x-upsert", copy ? "false" : "true");
    const response = await fetch(`${storage}/object/${path}`, { method: "POST", headers, body });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      if (copy && (response.status === 409 || Number(error?.statusCode) === 409)) return reply(409);
      return reply(502);
    }
    await response.body?.cancel();
    return reply(204);
  }

  return reply(405);
});
