import { formatSchema } from "./storage.js";

export function catalogView(records) {
  return {
    titleKey: "nav.catalog",
    records: records.map(schemaSummary),
    hasRecords: records.length > 0,
  };
}

export function schemaDetailView(record) {
  const schema = schemaSummary(record);
  const required = Array.isArray(record.raw.required) ? record.raw.required.map(String) : [];
  return {
    ...schema,
    requiredFields: required.join(", "),
    hasRequiredFields: required.length > 0,
    schemaJson: formatSchema(record.raw),
  };
}

export function newSchemaFormView({ error = "", schemaId = "", document = "" } = {}) {
  return {
    titleKey: "form.newSchemaTitle",
    pageTitleKey: "form.newSchemaTitle",
    action: "/manage/new",
    schemaId,
    document: document || defaultFormDocument(),
    error,
    hasError: Boolean(error),
    isExisting: false,
  };
}

export function editSchemaFormView(record, { error = "", document = "" } = {}) {
  return {
    title: `Edit ${record.title}`,
    pageTitle: `Edit ${record.title}`,
    action: `/manage/${record.id}/edit`,
    schemaId: record.id,
    document: document || formatSchema(record.raw),
    error,
    hasError: Boolean(error),
    isExisting: true,
    deletePath: `/manage/${record.id}/delete`,
  };
}

export function messageView(titleKey, messageKey = null, message = "") {
  return {
    titleKey,
    headingKey: titleKey,
    messageKey,
    message,
  };
}

export function defaultFormDocument() {
  return formatSchema({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "New Schema",
    description: "",
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  });
}

function schemaSummary(record) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    hasDescription: Boolean(record.description),
    draft: record.draft,
    updatedAt: record.updatedAt,
    hostedPath: record.hostedPath,
    catalogPath: record.catalogPath,
    editPath: `/manage/${record.id}/edit`,
    propertyCount: record.propertyCount,
    requiredCount: record.requiredCount,
  };
}
