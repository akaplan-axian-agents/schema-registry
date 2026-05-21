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

function jsonResponse(status, payload, contentType) {
  return {
    status,
    headers: {
      "Content-Type": contentType,
    },
    body: JSON.stringify(payload, null, 2),
  };
}
