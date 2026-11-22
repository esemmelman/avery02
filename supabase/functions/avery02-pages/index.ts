const origin = "https://esemmelman.github.io";
const bucket = "avery02-vowel-recordings";
const prefix = "avery02";
const storage = Deno.env.get("SUPABASE_URL") + "/storage/v1";
const role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const types = new Set(["audio/mp4", "audio/m4a", "audio/webm", "audio/ogg"]);
const vowels = new Set(["patah", "qamatz", "segol", "tsere", "hiriq", "holam", "qubuts", "shuruk",
  "sheva", "hataf-segol", "hataf-patah", "hataf-qamatz", "qamatz-qatan"]);
const pairId = /^pair-(?:0[1-9]|1[0-9]|2[0-5])$/;
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Cache-Control": "private, no-store",
  Vary: "Origin",
};

Deno.serve(async (request) => {
  const reply = (status: number) => new Response(null, { status, headers: cors });
  const caller = request.headers.get("Origin");
  if (caller !== origin) return reply(403);
  if (request.method === "OPTIONS") return reply(204);

  const query = new URL(request.url).searchParams;
  const clip = query.get("clip") ?? query.get("vowel");
  const headers = new Headers({ Authorization: `Bearer ${role}` });

  if (!clip && request.method === "GET") {
    headers.set("Content-Type", "application/json");
    const response = await fetch(`${storage}/object/list/${bucket}`, {
      method: "POST", headers, body: JSON.stringify({ prefix, limit: 100 }),
    });
    if (!response.ok) return reply(502);
    const objects: { name: string; id: string | null }[] = await response.json();
    const includePairs = query.get("scope") === "all";
    return Response.json(objects.filter(({ id, name }) => id &&
      (vowels.has(name) || (includePairs && pairId.test(name))))
      .map(({ name }) => name), { headers: cors });
  }

  if (!clip || !(vowels.has(clip) || pairId.test(clip))) return reply(404);
  const path = `${bucket}/${prefix}/${clip}`;
  if (request.method === "GET") {
    const response = await fetch(`${storage}/object/authenticated/${path}`, { headers });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      return reply(response.status === 404 || Number(error?.statusCode) === 404 ? 404 : 502);
    }
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
    headers.set("x-upsert", "true");
    const response = await fetch(`${storage}/object/${path}`, { method: "POST", headers, body });
    if (!response.ok) {
      return reply(502);
    }
    await response.body?.cancel();
    return reply(204);
  }

  return reply(405);
});
