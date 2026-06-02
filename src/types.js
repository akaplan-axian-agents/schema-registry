/**
 * @typedef {Record<string, unknown>} JsonObject
 *
 * @typedef {JsonObject & {
 *   $schema?: unknown,
 *   title?: unknown,
 *   description?: unknown,
 *   type?: unknown,
 *   properties?: unknown,
 *   required?: unknown
 * }} JsonSchemaDocument
 *
 * @typedef {object} SchemaRecord
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} draft
 * @property {string} path
 * @property {JsonSchemaDocument} raw
 * @property {string} updatedAt
 * @property {string} hostedPath
 * @property {string} catalogPath
 * @property {number} requiredCount
 * @property {number} propertyCount
 *
 * @typedef {object} SchemaStore
 * @property {() => Promise<SchemaRecord[]>} listSchemas
 * @property {(schemaId: string) => Promise<SchemaRecord>} getSchema
 * @property {(schemaId: string, schema: JsonSchemaDocument) => Promise<SchemaRecord>} saveSchema
 * @property {(schemaId: string) => Promise<void>} deleteSchema
 *
 * @typedef {object} RegistryConfig
 * @property {string} host
 * @property {number} port
 * @property {string} schemaRoot
 * @property {string} staticRoot
 * @property {string} viewsRoot
 * @property {string} localesRoot
 *
 * @typedef {object} HostedResponse
 * @property {number} status
 * @property {Record<string, string>} headers
 * @property {string} [body]
 *
 * @typedef {Record<string, unknown> & {
 *   title?: string,
 *   titleKey?: string,
 *   pageTitle?: string,
 *   pageTitleKey?: string,
 *   heading?: string,
 *   headingKey?: string,
 *   message?: string,
 *   messageKey?: string | null
 * }} RenderData
 *
 * @typedef {import("express").Request & {
 *   body: Record<string, unknown>,
 *   params: Record<string, string | string[]>,
 *   headers: import("node:http").IncomingHttpHeaders & { language?: string },
 *   resolvedLanguage?: string,
 *   language?: string,
 *   i18n?: import("i18next").i18n
 * }} RegistryRequest
 *
 * @callback RenderFunction
 * @param {RegistryRequest} req
 * @param {import("express").Response} res
 * @param {number} status
 * @param {string} view
 * @param {RenderData} data
 * @returns {void}
 */

export {};
