import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildApp, loadDotenv, projectRoot, readConfig } from "../src/config.js";

test("readConfig uses defaults when env values are absent", () => {
  const config = readConfig({});

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 8080);
  assert.equal(config.schemaRoot, path.join(projectRoot, "schemas"));
  assert.equal(config.staticRoot, path.join(projectRoot, "src", "static"));
  assert.equal(config.viewsRoot, path.join(projectRoot, "views"));
  assert.equal(config.localesRoot, path.join(projectRoot, "locales"));
});

test("readConfig uses environment values and falls back on invalid ports", () => {
  const configured = readConfig({
    HOST: "0.0.0.0",
    PORT: "9000",
    SCHEMA_ROOT: "custom-schemas",
    STATIC_ROOT: "public",
    VIEWS_ROOT: "templates",
    LOCALES_ROOT: "translations",
  });

  assert.equal(configured.host, "0.0.0.0");
  assert.equal(configured.port, 9000);
  assert.equal(configured.schemaRoot, path.resolve("custom-schemas"));
  assert.equal(configured.staticRoot, path.resolve("public"));
  assert.equal(configured.viewsRoot, path.resolve("templates"));
  assert.equal(configured.localesRoot, path.resolve("translations"));

  assert.equal(readConfig({ PORT: "not-a-port" }).port, 8080);
  assert.equal(readConfig({ PORT: "-1" }).port, 8080);
});

test("loadDotenv reads .env files without overriding existing environment values", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-env-"));
  const previousHost = process.env.HOST;
  const previousPort = process.env.PORT;
  try {
    const envPath = path.join(tempDir, ".env");
    await writeFile(envPath, "HOST=from-dotenv\nPORT=7777\n", "utf8");
    process.env.HOST = "from-environment";
    delete process.env.PORT;

    loadDotenv({ path: envPath });

    assert.equal(process.env.HOST, "from-environment");
    assert.equal(process.env.PORT, "7777");
  } finally {
    restoreEnv("HOST", previousHost);
    restoreEnv("PORT", previousPort);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("buildApp creates an Express app from config", async () => {
  const app = await buildApp(readConfig({}));
  assert.equal(typeof app.listen, "function");
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
