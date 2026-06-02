/**
 * Framework-neutral HTTP response for hosted machine-readable schema routes.
 *
 * @typedef {object} HostedResponse
 * @property {number} status HTTP status code to send.
 * @property {Record<string, string>} headers HTTP headers to attach to the response.
 * @property {string} [body] Serialized response body, when the route has content.
 */

/**
 * Builds the machine-readable hosted schema index response.
 *
 * @param {import("./storage.js").SchemaRecord[]} records
 * @returns {HostedResponse}
 */
export function hostedIndex(records) {
  const payload = {
    schemas: records.map((record) => ({
      catalog: record.catalogPath,
      id: record.id,
      schema: record.hostedPath,
      title: record.title,
      updated_at: record.updatedAt,
    })),
  };

  return jsonResponse(200, payload, "application/json; charset=utf-8");
}

/**
 * Builds the hosted JSON Schema document response.
 *
 * @param {{ raw: import("./storage.js").JsonSchemaDocument }} record
 * @returns {HostedResponse}
 */
export function hostedSchema(record) {
  return {
    status: 200,
    headers: {
      "Content-Type": "application/schema+json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
    body: `${JSON.stringify(record.raw, null, 2)}\n`,
  };
}

/**
 * Serializes a JSON payload into a response object.
 *
 * @param {number} status
 * @param {unknown} payload
 * @param {string} contentType
 * @returns {HostedResponse}
 */
function jsonResponse(status, payload, contentType) {
  return {
    status,
    headers: {
      "Content-Type": contentType,
    },
    body: JSON.stringify(payload, null, 2),
  };
}
