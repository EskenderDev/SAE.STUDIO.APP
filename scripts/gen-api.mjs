import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const specUrl = process.env.SAELABEL_OPENAPI_URL ?? "https://localhost:7097/openapi/v1.json";
const specPath = "openapi/saelabel.openapi.json";
const outputPath = "src/lib/api/generated";
const timeoutMs = Number(process.env.SAELABEL_OPENAPI_TIMEOUT_MS ?? 15000);

function fetchText(url, timeout) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.request(
      parsed,
      {
        method: "GET",
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 600)}`));
            return;
          }
          resolve(body);
        });
      },
    );

    req.on("error", reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error(`Timeout after ${timeout} ms`));
    });
    req.end();
  });
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

mkdirSync("openapi", { recursive: true });
mkdirSync(outputPath, { recursive: true });

let usingCachedSpec = false;

try {
  console.log(`[gen:api] Fetching OpenAPI spec from ${specUrl}`);
  const spec = await fetchText(specUrl, timeoutMs);
  JSON.parse(spec);
  writeFileSync(specPath, spec, "utf8");
  console.log(`[gen:api] Spec updated in ${specPath}`);
} catch (error) {
  try {
    JSON.parse(readFileSync(specPath, "utf8"));
    usingCachedSpec = true;
    console.warn(`[gen:api] Remote spec unavailable, using cached ${specPath}`);
    console.warn(`[gen:api] Reason: ${error instanceof Error ? error.message : String(error)}`);
  } catch {
    console.error("[gen:api] Could not fetch spec and no valid cached spec exists.");
    console.error(`[gen:api] Fetch error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

console.log(`[gen:api] Generating SDK from ${specPath}${usingCachedSpec ? " (cached)" : ""}`);
run(process.platform === "win32" ? "npx.cmd" : "npx", [
  "openapi-ts",
  "--input",
  `./${specPath}`,
  "--output",
  `./${outputPath}`,
]);
console.log("[gen:api] Done");
