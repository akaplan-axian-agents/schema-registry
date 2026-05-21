import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRegistryApp } from "../src/app.js";
import { createI18n } from "../src/i18n.js";
import { FileSystemSchemaStore } from "../src/storage.js";

async function makeApp({ store: providedStore = null, i18n = null } = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-registry-"));
  const store = providedStore || new FileSystemSchemaStore(path.join(tempDir, "schemas"));
  if (!providedStore) {
    await store.saveSchema("invoice", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Invoice",
      description: "Invoice document.",
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    });
  }

  return {
    tempDir,
    app: await createRegistryApp({
      store,
      staticRoot: path.resolve("src", "static"),
      viewsRoot: path.resolve("views"),
      localesRoot: path.resolve("locales"),
      i18n,
    }),
    store,
  };
}

test("root redirects to catalog and static CSS is served by middleware", async () => {
  const { app, tempDir } = await makeApp();
  const server = app.listen(0);
  try {
    const rootResponse = await fetch(serverUrl(server, "/"), { redirect: "manual" });
    assert.equal(rootResponse.status, 303);
    assert.equal(rootResponse.headers.get("location"), "/catalog/");

    const cssResponse = await fetch(serverUrl(server, "/static/site.css"));
    const cssBody = await cssResponse.text();
    assert.equal(cssResponse.status, 200);
    assert.match(cssResponse.headers.get("content-type"), /text\/css/);
    assert.match(cssResponse.headers.get("cache-control"), /max-age=3600/);
    assert.match(cssBody, /--accent/);
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("catalog is server-rendered HTML without script tags", async () => {
  const { app, tempDir } = await makeApp();
  const server = app.listen(0);
  try {
    const response = await fetch(serverUrl(server, "/catalog/"));
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(body, /Invoice/);
    assert.doesNotMatch(body.toLowerCase(), /<script/);
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("HTML display language follows Accept-Language with en-US fallback", async () => {
  const { app, tempDir } = await makeApp();
  const server = app.listen(0);
  try {
    const spanishResponse = await fetch(serverUrl(server, "/catalog/"), {
      headers: {
        "Accept-Language": "es-US,es;q=0.9",
      },
    });
    const spanishBody = await spanishResponse.text();

    assert.equal(spanishResponse.status, 200);
    assert.match(spanishBody, /Schemas disponibles/);
    assert.match(spanishBody, /Registro de JSON Schema/);

    const languageHeaderResponse = await fetch(serverUrl(server, "/catalog/"), {
      headers: {
        Language: "es-US",
      },
    });
    const languageHeaderBody = await languageHeaderResponse.text();

    assert.equal(languageHeaderResponse.status, 200);
    assert.match(languageHeaderBody, /Schemas disponibles/);

    const fallbackResponse = await fetch(serverUrl(server, "/catalog/"), {
      headers: {
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    });
    const fallbackBody = await fallbackResponse.text();

    assert.equal(fallbackResponse.status, 200);
    assert.match(fallbackBody, /Available schemas/);
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("schema detail, edit form, update, and delete routes work", async () => {
  const { app, store, tempDir } = await makeApp();
  const server = app.listen(0);
  try {
    const detailResponse = await fetch(serverUrl(server, "/catalog/invoice/"));
    const detailBody = await detailResponse.text();
    assert.equal(detailResponse.status, 200);
    assert.match(detailBody, /Invoice document/);
    assert.match(detailBody, /Required fields/);

    const editResponse = await fetch(serverUrl(server, "/manage/invoice/edit"));
    const editBody = await editResponse.text();
    assert.equal(editResponse.status, 200);
    assert.match(editBody, /Edit Invoice/);
    assert.match(editBody, /Delete schema/);

    const updateBody = new URLSearchParams({
      document: '{"title":"Updated Invoice","type":"object","properties":{}}',
    });
    const updateResponse = await fetch(serverUrl(server, "/manage/invoice/edit"), {
      method: "POST",
      body: updateBody,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "manual",
    });
    assert.equal(updateResponse.status, 303);
    assert.equal(updateResponse.headers.get("location"), "/catalog/invoice/");
    assert.equal((await store.getSchema("invoice")).title, "Updated Invoice");

    const deleteResponse = await fetch(serverUrl(server, "/manage/invoice/delete"), {
      method: "POST",
      redirect: "manual",
    });
    assert.equal(deleteResponse.status, 303);
    assert.equal(deleteResponse.headers.get("location"), "/catalog/");
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("HTML routes render 400 and 404 error pages", async () => {
  const { app, tempDir } = await makeApp();
  const server = app.listen(0);
  try {
    const newFormResponse = await fetch(serverUrl(server, "/manage/new"));
    const newFormHtml = await newFormResponse.text();
    assert.equal(newFormResponse.status, 200);
    assert.match(newFormHtml, /New Schema/);

    const invalidCreateBody = new URLSearchParams({
      schema_id: "bad",
      document: '{"type": 7}',
    });
    const invalidCreateResponse = await fetch(serverUrl(server, "/manage/new"), {
      method: "POST",
      body: invalidCreateBody,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const invalidCreateHtml = await invalidCreateResponse.text();
    assert.equal(invalidCreateResponse.status, 400);
    assert.match(invalidCreateHtml, /type&#x27; field must be a string or list/);

    const invalidEditBody = new URLSearchParams({
      document: '{"required": "id"}',
    });
    const invalidEditResponse = await fetch(serverUrl(server, "/manage/invoice/edit"), {
      method: "POST",
      body: invalidEditBody,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const invalidEditHtml = await invalidEditResponse.text();
    assert.equal(invalidEditResponse.status, 400);
    assert.match(invalidEditHtml, /required&#x27; field must be an array/);

    const missingSchemaResponse = await fetch(serverUrl(server, "/catalog/missing/"));
    const missingSchemaHtml = await missingSchemaResponse.text();
    assert.equal(missingSchemaResponse.status, 404);
    assert.match(missingSchemaHtml, /Schema &#x27;missing&#x27; was not found/);

    const missingPageResponse = await fetch(serverUrl(server, "/nope"));
    const missingPageHtml = await missingPageResponse.text();
    assert.equal(missingPageResponse.status, 404);
    assert.match(missingPageHtml, /The requested page does not exist/);

    const hostedNotFoundResponse = await fetch(serverUrl(server, "/hosted/schemas/readme.txt"));
    assert.equal(hostedNotFoundResponse.status, 404);
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("unexpected create and edit errors become plain 500 responses", async () => {
  const record = {
    id: "invoice",
    title: "Invoice",
    description: "",
    draft: "draft",
    raw: { title: "Invoice", type: "object", properties: {} },
    hostedPath: "/hosted/schemas/invoice.schema.json",
    catalogPath: "/catalog/invoice/",
    propertyCount: 0,
    requiredCount: 0,
  };
  const throwingStore = {
    async getSchema() {
      return record;
    },
    async saveSchema() {
      throw new Error("write failed");
    },
  };
  const { app, tempDir } = await makeApp({ store: throwingStore });
  const server = app.listen(0);
  const originalError = console.error;
  console.error = () => {};
  try {
    const createResponse = await fetch(serverUrl(server, "/manage/new"), {
      method: "POST",
      body: new URLSearchParams({
        schema_id: "payment",
        document: '{"title":"Payment","type":"object","properties":{}}',
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    assert.equal(createResponse.status, 500);
    assert.equal(await createResponse.text(), "Internal Server Error\n");

    const editResponse = await fetch(serverUrl(server, "/manage/invoice/edit"), {
      method: "POST",
      body: new URLSearchParams({
        document: '{"title":"Payment","type":"object","properties":{}}',
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    assert.equal(editResponse.status, 500);
    assert.equal(await editResponse.text(), "Internal Server Error\n");
  } finally {
    console.error = originalError;
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("schema errors outside form handlers render error pages", async () => {
  const schemaErrorStore = {
    async listSchemas() {
      throw new Error("not this path");
    },
    async getSchema() {
      const { SchemaError } = await import("../src/storage.js");
      throw new SchemaError("stored schema is malformed");
    },
  };
  const { app, tempDir } = await makeApp({ store: schemaErrorStore });
  const server = app.listen(0);
  try {
    const response = await fetch(serverUrl(server, "/catalog/invoice/"));
    const body = await response.text();
    assert.equal(response.status, 400);
    assert.match(body, /stored schema is malformed/);
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("unexpected route errors become plain 500 responses", async () => {
  const throwingStore = {
    async listSchemas() {
      throw new Error("database unavailable");
    },
  };
  const { app, tempDir } = await makeApp({ store: throwingStore });
  const server = app.listen(0);
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await fetch(serverUrl(server, "/catalog/"));
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.match(response.headers.get("content-type"), /text\/plain/);
    assert.equal(body, "Internal Server Error\n");
  } finally {
    console.error = originalError;
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("app can use a prebuilt i18n instance", async () => {
  const i18n = await createI18n({ localesRoot: path.resolve("locales") });
  const { app, tempDir } = await makeApp({ i18n });
  const server = app.listen(0);
  try {
    const response = await fetch(serverUrl(server, "/catalog/"));
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /Available schemas/);
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("hosted schema uses schema content type", async () => {
  const { app, tempDir } = await makeApp();
  const server = app.listen(0);
  try {
    const response = await fetch(serverUrl(server, "/hosted/schemas/invoice.schema.json"));
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/schema\+json/);
    assert.match(body, /"title": "Invoice"/);
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("hosted schema index lists available schemas", async () => {
  const { app, tempDir } = await makeApp();
  const server = app.listen(0);
  try {
    const response = await fetch(serverUrl(server, "/hosted/schemas/index.json"));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(payload.schemas.map((schema) => schema.id), ["invoice"]);
    assert.equal(payload.schemas[0].schema, "/hosted/schemas/invoice.schema.json");
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("create schema with HTML form", async () => {
  const { app, store, tempDir } = await makeApp();
  const server = app.listen(0);
  try {
    const body = new URLSearchParams({
      schema_id: "payment",
      document: '{"title":"Payment","type":"object","properties":{}}',
    });

    const response = await fetch(serverUrl(server, "/manage/new"), {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "manual",
    });

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/catalog/payment/");
    assert.equal((await store.getSchema("payment")).title, "Payment");
  } finally {
    await closeServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

function serverUrl(server, pathname) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}${pathname}`;
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
