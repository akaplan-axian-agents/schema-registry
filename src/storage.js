import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const schemaIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class SchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = "SchemaError";
  }
}

export class SchemaNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "SchemaNotFoundError";
  }
}

class SchemaRecord {
  constructor({ id, title, description, draft, filePath, raw, updatedAt }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.draft = draft;
    this.path = filePath;
    this.raw = raw;
    this.updatedAt = updatedAt;
  }

  get hostedPath() {
    return `/hosted/schemas/${this.id}.schema.json`;
  }

  get catalogPath() {
    return `/catalog/${this.id}/`;
  }

  get requiredCount() {
    return Array.isArray(this.raw.required) ? this.raw.required.length : 0;
  }

  get propertyCount() {
    return isPlainObject(this.raw.properties) ? Object.keys(this.raw.properties).length : 0;
  }
}

/**
 * File-backed implementation of the schema store contract.
 *
 * Route code only depends on listSchemas/getSchema/saveSchema/deleteSchema,
 * so this can be replaced by a database, object store, or git-backed store.
 */
export class FileSystemSchemaStore {
  constructor(root) {
    this.root = root;
  }

  async listSchemas() {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root);
    const schemaFiles = entries.filter((entry) => entry.endsWith(".schema.json")).sort();
    const records = await Promise.all(schemaFiles.map((entry) => this.#recordFromPath(path.join(this.root, entry))));
    return records.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getSchema(schemaId) {
    const filePath = this.#pathForId(schemaId);
    try {
      return await this.#recordFromPath(filePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new SchemaNotFoundError(`Schema '${schemaId}' was not found.`);
      }
      throw error;
    }
  }

  async saveSchema(schemaId, schema) {
    validateSchemaId(schemaId);
    validateSchemaDocument(schema);
    await mkdir(this.root, { recursive: true });
    const filePath = this.#pathForId(schemaId);
    await writeFile(filePath, `${formatSchema(schema)}\n`, "utf8");
    return this.#recordFromPath(filePath);
  }

  async deleteSchema(schemaId) {
    const filePath = this.#pathForId(schemaId);
    try {
      await unlink(filePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new SchemaNotFoundError(`Schema '${schemaId}' was not found.`);
      }
      throw error;
    }
  }

  #pathForId(schemaId) {
    validateSchemaId(schemaId);
    return path.join(this.root, `${schemaId}.schema.json`);
  }

  async #recordFromPath(filePath) {
    const fileName = path.basename(filePath);
    const id = fileName.slice(0, -".schema.json".length);
    let schema;

    try {
      schema = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new SchemaError(`${fileName} is not valid JSON: ${error.message}`);
      }
      throw error;
    }

    if (!isPlainObject(schema)) {
      throw new SchemaError(`${fileName} must contain a JSON object.`);
    }

    validateSchemaDocument(schema);
    const fileStat = await stat(filePath);
    return new SchemaRecord({
      id,
      title: typeof schema.title === "string" && schema.title ? schema.title : id,
      description: typeof schema.description === "string" ? schema.description : "",
      draft: typeof schema.$schema === "string" && schema.$schema ? schema.$schema : "unspecified",
      filePath,
      raw: schema,
      updatedAt: fileStat.mtime.toISOString(),
    });
  }
}

export function parseSchemaJson(document) {
  let schema;
  try {
    schema = JSON.parse(document);
  } catch (error) {
    throw new SchemaError(`Schema JSON is invalid: ${error.message}`);
  }
  if (!isPlainObject(schema)) {
    throw new SchemaError("Schema JSON must be an object.");
  }
  validateSchemaDocument(schema);
  return schema;
}

export function validateSchemaId(schemaId) {
  if (!schemaIdPattern.test(schemaId)) {
    throw new SchemaError("Use letters, numbers, dots, underscores, or hyphens for the schema id.");
  }
  if (schemaId.includes("..")) {
    throw new SchemaError("Schema ids cannot contain '..'.");
  }
}

export function validateSchemaDocument(schema) {
  if (!isPlainObject(schema)) {
    throw new SchemaError("Schema JSON must be an object.");
  }

  if (schema.type !== undefined && typeof schema.type !== "string" && !Array.isArray(schema.type)) {
    throw new SchemaError("The schema 'type' field must be a string or list when present.");
  }

  if (schema.properties !== undefined && !isPlainObject(schema.properties)) {
    throw new SchemaError("The schema 'properties' field must be an object when present.");
  }

  if (schema.required !== undefined && !Array.isArray(schema.required)) {
    throw new SchemaError("The schema 'required' field must be an array when present.");
  }
}

export function formatSchema(schema) {
  return JSON.stringify(schema, null, 2);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
