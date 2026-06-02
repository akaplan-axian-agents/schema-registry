import assert from "node:assert/strict";
import test from "node:test";
import { catalogView, editSchemaFormView, messageView, newSchemaFormView, schemaDetailView } from "../src/website.js";

function record(overrides = {}) {
  return {
    id: "thing",
    title: "Thing",
    description: "",
    draft: "draft",
    raw: {
      title: "Thing",
      properties: {},
    },
    hostedPath: "/hosted/schemas/thing.schema.json",
    catalogPath: "/catalog/thing/",
    propertyCount: 0,
    requiredCount: 0,
    ...overrides,
  };
}

test("catalogView marks empty and non-empty catalogs", () => {
  assert.equal(catalogView([]).hasRecords, false);

  const populated = catalogView([record({ description: "A thing" })]);
  assert.equal(populated.hasRecords, true);
  assert.equal(populated.records[0].hasDescription, true);
  assert.equal(populated.records[0].editPath, "/manage/thing/edit");
});

test("schemaDetailView handles absent and present required fields", () => {
  const withoutRequired = schemaDetailView(record());
  assert.equal(withoutRequired.hasRequiredFields, false);
  assert.equal(withoutRequired.requiredFields, "");

  const withRequired = schemaDetailView(record({ raw: { required: ["id", 2], properties: {} } }));
  assert.equal(withRequired.hasRequiredFields, true);
  assert.equal(withRequired.requiredFields, "id, 2");
  assert.match(withRequired.schemaJson, /"required"/);
});

test("form and message view helpers expose template state", () => {
  const newForm = newSchemaFormView({ error: "Nope", schemaId: "bad", document: "" });
  assert.equal(newForm.hasError, true);
  assert.equal(newForm.isExisting, false);
  assert.match(newForm.document, /New Schema/);

  const editForm = editSchemaFormView(record(), { document: '{"type":"object"}' });
  assert.equal(editForm.isExisting, true);
  assert.equal(editForm.deletePath, "/manage/thing/delete");
  assert.equal(editForm.document, '{"type":"object"}');

  assert.deepEqual(messageView("message.notFound", "message.pageDoesNotExist"), {
    titleKey: "message.notFound",
    headingKey: "message.notFound",
    messageKey: "message.pageDoesNotExist",
    message: "",
  });
});
