import { vowels } from "./vowels.js";

const ids = new Set(vowels.map(([id]) => id));
const endpoint = "https://fgomaujsdblpzxhnnqrg.supabase.co/functions/v1/avery02-pages";

export default {
  async fetch(request, env) {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname !== "/_transfer-recordings" || request.method !== "POST" ||
        !env.AUDIO_MIGRATION_TOKEN ||
        request.headers.get("Authorization") !== `Bearer ${env.AUDIO_MIGRATION_TOKEN}`) {
      return new Response("This recorder address has been retired.", { status: 410 });
    }

    const { objects, truncated } = await env.BUCKET.list({ prefix: "recordings/" });
    const clips = objects.filter(({ key }) => ids.has(key.split("/").at(-1)));
    if (truncated || new Set(clips.map(({ key }) => key.split("/")[1])).size > 1) {
      return new Response("Cannot automatically transfer recordings with ambiguous ownership.", { status: 409 });
    }

    const legacyOwner = searchParams.get("legacyOwner");
    if (legacyOwner && !/^[a-f0-9]{64}$/.test(legacyOwner)) {
      return new Response("Invalid legacy owner.", { status: 400 });
    }
    const previous = (id) => {
      const url = new URL(env.SUPABASE_RECORDINGS_URL);
      url.searchParams.set("owner", legacyOwner);
      if (id) url.searchParams.set("vowel", id);
      return fetch(url, { headers: { Authorization: `Bearer ${env.SUPABASE_RECORDINGS_TOKEN}` } });
    };
    const transfer = (id, type, body) => {
      const url = new URL(endpoint);
      url.searchParams.set("vowel", id);
      url.searchParams.set("copy", "1");
      return fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.PAGES_AUDIO_ACCESS_CODE}`,
          "Content-Type": type,
        },
        body,
      });
    };
    let transferred = 0;
    if (legacyOwner) {
      const index = await previous();
      if (!index.ok) return new Response("Could not list legacy recordings.", { status: 502 });
      for (const id of (await index.json()).filter((id) => ids.has(id))) {
        const audio = await previous(id);
        if (!audio.ok) return new Response("Could not read a legacy recording.", { status: 502 });
        const response = await transfer(id, audio.headers.get("Content-Type"), await audio.arrayBuffer());
        if (!response.ok && response.status !== 409) {
          return Response.json({ transferred, storageStatus: response.status }, { status: 502 });
        }
        transferred++;
      }
    }
    for (const { key } of clips) {
      const object = await env.BUCKET.get(key);
      if (!object) continue;
      const response = await transfer(key.split("/").at(-1), object.httpMetadata.contentType,
        await object.arrayBuffer());
      if (!response.ok && response.status !== 409) {
        return Response.json({ transferred, storageStatus: response.status }, { status: 502 });
      }
      transferred++;
    }
    return Response.json({ transferred });
  },
};
