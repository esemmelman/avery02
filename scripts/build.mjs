import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const routes = {
  "/": ["index.html", "text/html"],
  "/style.css": ["style.css", "text/css"],
  "/app.js": ["app.js", "text/javascript"],
  "/vowels.js": ["vowels.js", "text/javascript"],
};
const assets = Object.create(null);
for (const [route, [name, type]] of Object.entries(routes)) {
  assets[route] = { body: await readFile(`web/${name}`, "utf8"), type: `${type}; charset=utf-8` };
}
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("worker/index.js", "dist/server/index.js");
await cp("web/vowels.js", "dist/server/vowels.js");
await writeFile("dist/server/assets.js", `export const assets = ${JSON.stringify(assets)};\n`);
