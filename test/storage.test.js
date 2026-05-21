import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  FileSystemSchemaStore,
  SchemaError,
  SchemaNotFoundError,
  parseSchemaJson,
  validateSchemaDocument,
  validateSchemaId,
} from "../src/storage.js";

test("save, list, and get schema", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-"));
  try {
    const store = new FileSystemSchemaStore(tempDir);
    const record = await store.saveSchema("thing", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Thing",
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    });

    assert.equal(record.id, "thing");
    assert.equal(record.propertyCount, 1);
    assert.equal((await store.getSchema("thing")).title, "Thing");
    assert.deepEqual((await store.listSchemas()).map((item) => item.id), ["thing"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("listSchemas ignores non-schema files and returns empty directories", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-"));
  try {
    const store = new FileSystemSchemaStore(tempDir);
    await writeFile(path.join(tempDir, "note.txt"), "hello", "utf8");
    assert.deepEqual(await store.listSchemas(), []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("schema record derives defaults and zero counts", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-"));
  try {
    const store = new FileSystemSchemaStore(tempDir);
    const record = await store.saveSchema("minimal", {});

    assert.equal(record.title, "minimal");
    assert.equal(record.description, "");
    assert.equal(record.draft, "unspecified");
    assert.equal(record.requiredCount, 0);
    assert.equal(record.propertyCount, 0);
    assert.equal(record.hostedPath, "/hosted/schemas/minimal.schema.json");
    assert.equal(record.catalogPath, "/catalog/minimal/");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects path-like ids", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-"));
  try {
    const store = new FileSystemSchemaStore(tempDir);
    await assert.rejects(() => store.saveSchema("../escape", { type: "object" }), SchemaError);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("delete missing schema raises", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-"));
  try {
    const store = new FileSystemSchemaStore(tempDir);
    await assert.rejects(() => store.deleteSchema("missing"), SchemaNotFoundError);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("get missing schema raises", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-"));
  try {
    const store = new FileSystemSchemaStore(tempDir);
    await assert.rejects(() => store.getSchema("missing"), SchemaNotFoundError);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("invalid stored files raise schema errors", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-"));
  try {
    const store = new FileSystemSchemaStore(tempDir);
    await writeFile(path.join(tempDir, "broken.schema.json"), "{", "utf8");
    await assert.rejects(() => store.getSchema("broken"), SchemaError);

    await writeFile(path.join(tempDir, "array.schema.json"), "[]", "utf8");
    await assert.rejects(() => store.getSchema("array"), SchemaError);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filesystem errors other than missing files bubble up", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-"));
  try {
    const store = new FileSystemSchemaStore(tempDir);
    await mkdir(path.join(tempDir, "blocked.schema.json"));
    await assert.rejects(() => store.getSchema("blocked"), { code: "EISDIR" });
    await assert.rejects(
      () => store.deleteSchema("blocked"),
      (error) => ["EISDIR", "EPERM"].includes(error.code),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("parseSchemaJson requires an object", () => {
  assert.throws(() => parseSchemaJson(JSON.stringify(["not", "an", "object"])), SchemaError);
});

test("parseSchemaJson rejects invalid JSON", () => {
  assert.throws(() => parseSchemaJson("{"), SchemaError);
});

test("schema id validation rejects invalid patterns and path traversal", () => {
  assert.throws(() => validateSchemaId("bad/id"), SchemaError);
  assert.throws(() => validateSchemaId("bad..id"), SchemaError);
});

test("schema document validation rejects invalid field shapes", () => {
  assert.throws(() => validateSchemaDocument(null), SchemaError);
  assert.throws(() => validateSchemaDocument({ type: 7 }), SchemaError);
  assert.throws(() => validateSchemaDocument({ properties: [] }), SchemaError);
  assert.throws(() => validateSchemaDocument({ required: "id" }), SchemaError);
});
