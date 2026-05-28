import express from "express";
import { hostedIndex, hostedSchema } from "./hosting.js";
import { SchemaError, SchemaNotFoundError, parseSchemaJson } from "./storage.js";
import {
  catalogView,
  editSchemaFormView,
  messageView,
  newSchemaFormView,
  schemaDetailView,
} from "./website.js";

export function createSchemaManagementRouter({ store, render }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.redirect(303, "/catalog/");
  });

  router.get("/catalog/", asyncHandler(async (req, res) => {
    render(req, res, 200, "catalog", catalogView(await store.listSchemas()));
  }));

  router.get("/catalog/:schemaId/", asyncHandler(async (req, res) => {
    const record = await store.getSchema(req.params.schemaId);
    render(req, res, 200, "schema-detail", schemaDetailView(record));
  }));

  router.get("/hosted/schemas/index.json", asyncHandler(async (_req, res) => {
    sendResponse(res, hostedIndex(await store.listSchemas()));
  }));

  router.get("/hosted/schemas/:schemaFile", asyncHandler(async (req, res, next) => {
    if (!req.params.schemaFile.endsWith(".schema.json")) {
      next();
      return;
    }

    const schemaId = req.params.schemaFile.slice(0, -".schema.json".length);
    sendResponse(res, hostedSchema(await store.getSchema(schemaId)));
  }));

  router.get("/manage/new", (req, res) => {
    render(req, res, 200, "schema-form", newSchemaFormView());
  });

  router.post("/manage/new", asyncHandler(async (req, res) => {
    const schemaId = String(req.body.schema_id || "").trim();
    const document = String(req.body.document || "");

    try {
      const schema = parseSchemaJson(document);
      await store.saveSchema(schemaId, schema);
    } catch (error) {
      if (error instanceof SchemaError) {
        render(req, res, 400, "schema-form", newSchemaFormView({ error: error.message, schemaId, document }));
        return;
      }
      throw error;
    }

    res.redirect(303, `/catalog/${schemaId}/`);
  }));

  router.get("/manage/:schemaId/edit", asyncHandler(async (req, res) => {
    const record = await store.getSchema(req.params.schemaId);
    render(req, res, 200, "schema-form", editSchemaFormView(record));
  }));

  router.post("/manage/:schemaId/edit", asyncHandler(async (req, res) => {
    const schemaId = req.params.schemaId;
    const document = String(req.body.document || "");

    try {
      const schema = parseSchemaJson(document);
      await store.saveSchema(schemaId, schema);
    } catch (error) {
      if (error instanceof SchemaError) {
        const record = await store.getSchema(schemaId);
        render(req, res, 400, "schema-form", editSchemaFormView(record, { error: error.message, document }));
        return;
      }
      throw error;
    }

    res.redirect(303, `/catalog/${schemaId}/`);
  }));

  router.post("/manage/:schemaId/delete", asyncHandler(async (req, res) => {
    await store.deleteSchema(req.params.schemaId);
    res.redirect(303, "/catalog/");
  }));

  return router;
}

export function createSchemaManagementNotFoundHandler({ render }) {
  return (req, res) => {
    render(req, res, 404, "message", messageView("message.notFound", "message.pageDoesNotExist"));
  };
}

export function createSchemaManagementErrorHandler({ render }) {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof SchemaNotFoundError) {
      render(req, res, 404, "message", messageView("message.notFound", null, error.message));
      return;
    }

    if (error instanceof SchemaError) {
      render(req, res, 400, "message", messageView("message.genericError", null, error.message));
      return;
    }

    console.error(error);
    res.status(500).type("text/plain; charset=utf-8").send("Internal Server Error\n");
  };
}

export function sendResponse(res, response) {
  res.status(response.status).set(response.headers).send(response.body || "");
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
