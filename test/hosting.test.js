import assert from "node:assert/strict";
import test from "node:test";
import { hostedIndex, hostedSchema } from "../src/hosting.js";

test("hostedIndex returns machine-readable schema metadata", () => {
  const response = hostedIndex([
    {
      id: "customer",
      title: "Customer",
      hostedPath: "/hosted/schemas/customer.schema.json",
      catalogPath: "/catalog/customer/",
      updatedAt: "2026-05-21T00:00:00.000Z",
    },
  ]);

  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(response.body), {
    schemas: [
      {
        catalog: "/catalog/customer/",
        id: "customer",
        schema: "/hosted/schemas/customer.schema.json",
        title: "Customer",
        updated_at: "2026-05-21T00:00:00.000Z",
      },
    ],
  });
});

test("hostedSchema returns application/schema+json", () => {
  const response = hostedSchema({
    raw: {
      title: "Customer",
      type: "object",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "application/schema+json; charset=utf-8");
  assert.equal(response.headers["Cache-Control"], "public, max-age=60");
  assert.match(response.body, /"title": "Customer"/);
  assert.ok(response.body.endsWith("\n"));
});
