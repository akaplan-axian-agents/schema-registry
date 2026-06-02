import { formatSchema } from "./storage.js";

/**
 * Builds the catalog template data for schema summaries.
 *
 * @param {import("./storage.js").SchemaRecord[]} records
 * @returns {Record<string, unknown>}
 */
export function catalogView(records) {
  return {
    titleKey: "nav.catalog",
    records: records.map(schemaSummary),
    hasRecords: records.length > 0,
  };
}

/**
 * Builds the schema detail template data.
 *
 * @param {import("./storage.js").SchemaRecord} record
 * @returns {Record<string, unknown>}
 */
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

/**
 * Builds the blank new-schema form template data.
 *
 * @param {{ error?: string, schemaId?: string, document?: string }} [options]
 * @returns {Record<string, unknown>}
 */
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

/**
 * Builds the edit form template data for an existing schema.
 *
 * @param {import("./storage.js").SchemaRecord} record
 * @param {{ error?: string, document?: string }} [options]
 * @returns {Record<string, unknown>}
 */
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

/**
 * Builds a generic message page template data object.
 *
 * @param {string} titleKey
 * @param {string | null} [messageKey]
 * @param {string} [message]
 * @returns {Record<string, unknown>}
 */
export function messageView(titleKey, messageKey = null, message = "") {
  return {
    titleKey,
    headingKey: titleKey,
    messageKey,
    message,
  };
}

/**
 * Provides the default JSON document shown by the new-schema form.
 *
 * @returns {string}
 */
function defaultFormDocument() {
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

/**
 * Builds reusable schema summary template data.
 *
 * @param {import("./storage.js").SchemaRecord} record
 * @returns {Record<string, unknown>}
 */
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
