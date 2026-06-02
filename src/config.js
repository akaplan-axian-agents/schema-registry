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

/**
 * Runtime settings used to build and listen with the schema registry.
 *
 * @typedef {object} RegistryConfig
 * @property {string} host Network interface the HTTP server binds to.
 * @property {number} port TCP port the HTTP server listens on.
 * @property {string} schemaRoot Directory containing persisted JSON Schema files.
 * @property {string} staticRoot Directory containing static browser assets.
 * @property {string} viewsRoot Directory containing Handlebars view templates.
 * @property {string} localesRoot Directory containing localization files.
 */

/**
 * Loads environment variables from dotenv without overriding existing values.
 *
 * @param {import("dotenv").DotenvConfigOptions} [options]
 * @returns {import("dotenv").DotenvConfigOutput}
 */
export function loadDotenv(options = {}) {
  return dotenv.config({ quiet: true, ...options });
}

/**
 * Reads runtime configuration from environment variables and defaults.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {RegistryConfig}
 */
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

/**
 * Builds the configured Express application.
 *
 * @param {RegistryConfig} [config]
 * @returns {Promise<import("express").Express>}
 */
export async function buildApp(config = readConfig()) {
  return createRegistryApp({
    store: new FileSystemSchemaStore(config.schemaRoot),
    staticRoot: config.staticRoot,
    viewsRoot: config.viewsRoot,
    localesRoot: config.localesRoot,
  });
}

/**
 * Parses a positive integer port or returns the configured fallback.
 *
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function readPort(value, fallback) {
  const port = Number.parseInt(value || "", 10);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

/**
 * Resolves a configured path or its default relative to the current process.
 *
 * @param {string | undefined} value
 * @param {string} fallback
 * @returns {string}
 */
function resolveConfiguredPath(value, fallback) {
  return path.resolve(value || fallback);
}
