import { practicePairs, vowels } from "./vowels.js?v=4";

const pageUrl = new URL(location.href);
if (pageUrl.searchParams.has("from-retired")) {
  pageUrl.searchParams.delete("from-retired");
  history.replaceState(null, "", pageUrl);
}

const byId = (id) => document.getElementById(id);
const nav = byId("vowels");
const record = byId("record");
const save = byId("save");
const player = byId("player");
const status = byId("status");
const endpoint = "https://fgomaujsdblpzxhnnqrg.supabase.co/functions/v1/avery02-pages";
const drafts = new Map();
let clips = new Map();
let saved = new Set();
let selected = vowels[0][0];
let recorder;
let busy = false;
let ready = false;
let timer;
let previewUrl;
let previewBlob;

for (const pair of practicePairs) {
  const item = document.createElement("li");
  item.textContent = pair;
  byId("practice").append(item);
}

const vowelOptions = new Map();
for (const [id, symbol] of vowels) {
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "vowel";
  input.id = `vowel-${id}`;
  const label = document.createElement("label");
  label.htmlFor = input.id;
  label.lang = "he";
  label.dir = "rtl";
  label.textContent = symbol;
  input.addEventListener("click", () => {
    selected = id;
    status.textContent = "";
    render();
    if (player.hidden) return;
    player.currentTime = 0;
    const source = player.src;
    player.play().catch((error) => {
      if (error.name !== "AbortError" && player.src === source) {
        status.textContent = "Playback failed. Try tapping the vowel again or use the audio controls.";
      }
    });
  });
  vowelOptions.set(id, { input, label });
  nav.append(input, label);
}

function render() {
  const [, symbol] = vowels.find(([id]) => id === selected);
  byId("symbol").textContent = symbol;
  byId("progress").textContent = ready ? `${saved.size} of ${vowels.length} saved`
    : busy ? "Loading recordings…" : "Sync unavailable";
  for (const [id, { input, label }] of vowelOptions) {
    input.disabled = busy || !!recorder;
    input.checked = id === selected;
    label.toggleAttribute("data-saved", saved.has(id));
  }
  record.disabled = busy;
  record.toggleAttribute("data-recording", !!recorder);
  record.textContent = recorder ? "Stop recording" : saved.has(selected) ? "Record again" : "Record sound";
  save.hidden = !drafts.has(selected) || !!recorder;
  save.disabled = busy;
  if (recorder) return;
  const draft = drafts.get(selected) || clips.get(selected);
  if (draft !== previewBlob) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewBlob = draft;
    previewUrl = draft ? URL.createObjectURL(draft) : undefined;
  }
  const source = previewUrl || null;
  player.hidden = !source;
  if (player.getAttribute("src") === source) return;
  player.pause();
  if (source) {
    player.src = source;
  } else {
    player.removeAttribute("src");
    player.load();
  }
}

function audioRequest(id, options = {}) {
  const url = new URL(endpoint);
  if (id) url.searchParams.set("vowel", id);
  return fetch(url, options);
}

async function refresh() {
  const response = await audioRequest();
  if (!response.ok) throw new Error("Could not connect to recordings.");
  const ids = await response.json();
  const recordings = await Promise.all(ids.map(async (id) => {
    const audio = await audioRequest(id);
    if (!audio.ok) throw new Error("Could not load recordings.");
    return [id, await audio.blob()];
  }));
  clips = new Map(recordings);
  saved = new Set(ids);
  ready = true;
}

save.addEventListener("click", async () => {
  const id = selected;
  const draft = drafts.get(id);
  if (!draft) return;
  busy = true;
  render();
  status.textContent = "Saving…";
  try {
    const response = await audioRequest(id, { method: "PUT", body: draft });
    if (!response.ok) throw new Error("Upload failed");
    drafts.delete(id);
    clips.set(id, draft);
    saved.add(id);
    ready = true;
    status.textContent = "Saved. Available on your other devices.";
  } catch {
    status.textContent = "Could not save. Your clip is still here. Tap Save recording to retry.";
  } finally {
    busy = false;
    render();
  }
});

record.addEventListener("click", async () => {
  if (recorder) {
    if (recorder.state !== "inactive") recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    status.textContent = "Open the secure recorder link in Safari or another browser with microphone access.";
    return;
  }
  busy = true;
  render();
  const id = selected;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferMp4 = MediaRecorder.isTypeSupported("audio/mp4");
    recorder = new MediaRecorder(stream, preferMp4 ? { mimeType: "audio/mp4" } : undefined);
    const chunks = [];
    let failed = false;
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("error", () => { failed = true; });
    recorder.addEventListener("stop", () => {
      clearTimeout(timer);
      stream.getTracks().forEach((track) => track.stop());
      const type = chunks[0]?.type || recorder.mimeType || "audio/mp4";
      recorder = undefined;
      if (chunks.length && !failed) {
        drafts.set(id, new Blob(chunks, { type }));
        status.textContent = "Play it back, then save to sync.";
      } else {
        status.textContent = "No audio captured. Try recording again.";
      }
      render();
    }, { once: true });
    recorder.start();
    player.pause();
    player.hidden = true;
    timer = setTimeout(() => {
      if (recorder?.state === "recording") recorder.stop();
    }, 30_000);
    status.textContent = "Recording… Tap Stop when finished.";
  } catch {
    stream?.getTracks().forEach((track) => track.stop());
    recorder = undefined;
    status.textContent = "Could not start the microphone. Check this site's microphone permission.";
  } finally {
    busy = false;
    render();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!drafts.size && !recorder) return;
  event.preventDefault();
  event.returnValue = true;
});
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || busy || recorder) return;
  busy = true;
  try {
    await refresh();
  } catch { /* Preserve the available clips until the next sync. */ }
  finally {
    busy = false;
    render();
  }
});
busy = true;
render();
try {
  await refresh();
} catch {
  status.textContent = "Could not load saved recordings. Reload to try again.";
} finally {
  busy = false;
  render();
}
