import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRegistryApp } from "./app.js";
import { FileSystemSchemaStore } from "./storage.js";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const defaults = {
  host: "127.0.0.1",
  port: 8080,
  schemaRoot: path.join(projectRoot, "schemas"),
  staticRoot: path.join(projectRoot, "src", "static"),
  viewsRoot: path.join(projectRoot, "views"),
  localesRoot: path.join(projectRoot, "locales"),
};

export function loadDotenv(options = {}) {
  return dotenv.config({ quiet: true, ...options });
}

export function readConfig(env = process.env) {
  return {
    host: env.HOST || defaults.host,
    port: readPort(env.PORT, defaults.port),
    schemaRoot: resolveConfiguredPath(env.SCHEMA_ROOT, defaults.schemaRoot),
    staticRoot: resolveConfiguredPath(env.STATIC_ROOT, defaults.staticRoot),
    viewsRoot: resolveConfiguredPath(env.VIEWS_ROOT, defaults.viewsRoot),
    localesRoot: resolveConfiguredPath(env.LOCALES_ROOT, defaults.localesRoot),
  };
}

export async function buildApp(config = readConfig()) {
  return createRegistryApp({
    store: new FileSystemSchemaStore(config.schemaRoot),
    staticRoot: config.staticRoot,
    viewsRoot: config.viewsRoot,
    localesRoot: config.localesRoot,
  });
}

function readPort(value, fallback) {
  const port = Number.parseInt(value || "", 10);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function resolveConfiguredPath(value, fallback) {
  return path.resolve(value || fallback);
}
