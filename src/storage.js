import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const schemaIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * @typedef {import("json-schema").JSONSchema7} JsonSchemaDocument
 *
 * @typedef {object} SchemaStore
 * @property {() => Promise<SchemaRecord[]>} listSchemas
 * @property {(schemaId: string) => Promise<SchemaRecord>} getSchema
 * @property {(schemaId: string, schema: JsonSchemaDocument) => Promise<SchemaRecord>} saveSchema
 * @property {(schemaId: string) => Promise<void>} deleteSchema
 */

export class SchemaError extends Error {
  /**
   * Creates an application error for invalid schema input or stored content.
   *
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "SchemaError";
  }
}

export class SchemaNotFoundError extends Error {
  /**
   * Creates an application error for a missing stored schema.
   *
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "SchemaNotFoundError";
  }
}

export class SchemaRecord {
  /**
   * Creates the view and hosted representation of a schema file.
   *
   * @param {{
   *   id: string,
   *   title: string,
   *   description: string,
   *   draft: string,
   *   filePath: string,
   *   raw: JsonSchemaDocument,
   *   updatedAt: string
   * }} data
   */
  constructor({ id, title, description, draft, filePath, raw, updatedAt }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.draft = draft;
    this.path = filePath;
    this.raw = raw;
    this.updatedAt = updatedAt;
  }

  /**
   * Returns the public machine-readable URL for the schema.
   *
   * @returns {string}
   */
  get hostedPath() {
    return `/hosted/schemas/${this.id}.schema.json`;
  }

  /**
   * Returns the human catalog URL for the schema.
   *
   * @returns {string}
   */
  get catalogPath() {
    return `/catalog/${this.id}/`;
  }

  /**
   * Counts required schema fields when the schema declares them as an array.
   *
   * @returns {number}
   */
  get requiredCount() {
    return Array.isArray(this.raw.required) ? this.raw.required.length : 0;
  }

  /**
   * Counts declared schema properties when the schema declares an object.
   *
   * @returns {number}
   */
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
  /**
   * Creates a schema store rooted at a filesystem directory.
   *
   * @param {string} root
   */
  constructor(root) {
    this.root = root;
  }

  /**
   * Lists all valid schema records in sorted id order.
   *
   * @returns {Promise<SchemaRecord[]>}
   */
  async listSchemas() {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root);
    const schemaFiles = entries.filter((entry) => entry.endsWith(".schema.json")).sort();
    const records = await Promise.all(schemaFiles.map((entry) => this.#recordFromPath(path.join(this.root, entry))));
    return records.sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Reads a schema record by id.
   *
   * @param {string} schemaId
   * @returns {Promise<SchemaRecord>}
   */
  async getSchema(schemaId) {
    const filePath = this.#pathForId(schemaId);
    try {
      return await this.#recordFromPath(filePath);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new SchemaNotFoundError(`Schema '${schemaId}' was not found.`);
      }
      throw error;
    }
  }

  /**
   * Validates and writes a schema document by id.
   *
   * @param {string} schemaId
   * @param {JsonSchemaDocument} schema
   * @returns {Promise<SchemaRecord>}
   */
  async saveSchema(schemaId, schema) {
    validateSchemaId(schemaId);
    validateSchemaDocument(schema);
    await mkdir(this.root, { recursive: true });
    const filePath = this.#pathForId(schemaId);
    await writeFile(filePath, `${formatSchema(schema)}\n`, "utf8");
    return this.#recordFromPath(filePath);
  }

  /**
   * Deletes a schema document by id.
   *
   * @param {string} schemaId
   * @returns {Promise<void>}
   */
  async deleteSchema(schemaId) {
    const filePath = this.#pathForId(schemaId);
    try {
      await unlink(filePath);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new SchemaNotFoundError(`Schema '${schemaId}' was not found.`);
      }
      throw error;
    }
  }

  /**
   * Builds the expected schema file path for an id after validating it.
   *
   * @param {string} schemaId
   * @returns {string}
   */
  #pathForId(schemaId) {
    validateSchemaId(schemaId);
    return path.join(this.root, `${schemaId}.schema.json`);
  }

  /**
   * Reads and validates a schema record from a file path.
   *
   * @param {string} filePath
   * @returns {Promise<SchemaRecord>}
   */
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

/**
 * Parses and validates a JSON Schema document from a string.
 *
 * @param {string} document
 * @returns {JsonSchemaDocument}
 */
export function parseSchemaJson(document) {
  let schema;
  try {
    schema = JSON.parse(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SchemaError(`Schema JSON is invalid: ${message}`);
  }
  if (!isPlainObject(schema)) {
    throw new SchemaError("Schema JSON must be an object.");
  }
  validateSchemaDocument(schema);
  return schema;
}

/**
 * Validates the schema id syntax accepted by filesystem-backed storage.
 *
 * @param {string} schemaId
 * @returns {void}
 */
export function validateSchemaId(schemaId) {
  if (!schemaIdPattern.test(schemaId)) {
    throw new SchemaError("Use letters, numbers, dots, underscores, or hyphens for the schema id.");
  }
  if (schemaId.includes("..")) {
    throw new SchemaError("Schema ids cannot contain '..'.");
  }
}

/**
 * Validates the currently supported JSON Schema document shape.
 *
 * @param {unknown} schema
 * @returns {asserts schema is JsonSchemaDocument}
 */
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

/**
 * Formats a schema document as stable pretty JSON.
 *
 * @param {unknown} schema
 * @returns {string}
 */
export function formatSchema(schema) {
  return JSON.stringify(schema, null, 2);
}

/**
 * Checks whether a value is a non-array object.
 *
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Checks whether an unknown thrown value is a Node filesystem error.
 *
 * @param {unknown} error
 * @returns {error is NodeJS.ErrnoException}
 */
function isNodeError(error) {
  return error instanceof Error && "code" in error;
}
