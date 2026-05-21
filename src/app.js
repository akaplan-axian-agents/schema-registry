import express from "express";
import { engine } from "express-handlebars";
import { hostedIndex, hostedSchema } from "./hosting.js";
import { createI18n, fallbackLanguage, i18nMiddleware } from "./i18n.js";
import { SchemaError, SchemaNotFoundError, parseSchemaJson } from "./storage.js";
import {
  catalogView,
  editSchemaFormView,
  messageView,
  newSchemaFormView,
  schemaDetailView,
} from "./website.js";

export async function createRegistryApp({ store, staticRoot, viewsRoot, localesRoot, i18n = null }) {
  const app = express();
  const i18nInstance = i18n || await createI18n({ localesRoot });
  app.locals.store = store;
  app.locals.staticRoot = staticRoot;
  app.locals.viewsRoot = viewsRoot;

  app.engine("handlebars", engine({
    helpers: {
      t(key, options) {
        const language = options.data.root.language || fallbackLanguage;
        return i18nInstance.getFixedT(language)(key);
      },
    },
  }));
  app.set("view engine", "handlebars");
  app.set("views", viewsRoot);
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(copyLanguageHeaderForHtmlRequests);
  app.use(i18nForHtmlRequests(i18nInstance));
  app.use(
    "/static",
    express.static(staticRoot, {
      maxAge: "1h",
    }),
  );

  app.get("/", (_req, res) => {
    res.redirect(303, "/catalog/");
  });

  app.get("/catalog/", asyncHandler(async (_req, res) => {
    render(_req, res, 200, "catalog", catalogView(await store.listSchemas()));
  }));

  app.get("/catalog/:schemaId/", asyncHandler(async (req, res) => {
    const record = await store.getSchema(req.params.schemaId);
    render(req, res, 200, "schema-detail", schemaDetailView(record));
  }));

  app.get("/hosted/schemas/index.json", asyncHandler(async (_req, res) => {
    sendResponse(res, hostedIndex(await store.listSchemas()));
  }));

  app.get("/hosted/schemas/:schemaFile", asyncHandler(async (req, res, next) => {
    if (!req.params.schemaFile.endsWith(".schema.json")) {
      next();
      return;
    }

    const schemaId = req.params.schemaFile.slice(0, -".schema.json".length);
    sendResponse(res, hostedSchema(await store.getSchema(schemaId)));
  }));

  app.get("/manage/new", (_req, res) => {
    render(_req, res, 200, "schema-form", newSchemaFormView());
  });

  app.post("/manage/new", asyncHandler(async (req, res) => {
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

  app.get("/manage/:schemaId/edit", asyncHandler(async (req, res) => {
    const record = await store.getSchema(req.params.schemaId);
    render(req, res, 200, "schema-form", editSchemaFormView(record));
  }));

  app.post("/manage/:schemaId/edit", asyncHandler(async (req, res) => {
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

  app.post("/manage/:schemaId/delete", asyncHandler(async (req, res) => {
    await store.deleteSchema(req.params.schemaId);
    res.redirect(303, "/catalog/");
  }));

  app.use((req, res) => {
    render(req, res, 404, "message", messageView("message.notFound", "message.pageDoesNotExist"));
  });

  app.use((error, req, res, next) => {
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
  });

  return app;
}

export function sendResponse(res, response) {
  res.status(response.status).set(response.headers).send(response.body || "");
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function render(req, res, status, view, data) {
  const language = req.resolvedLanguage || req.language || fallbackLanguage;
  const translate = i18nTranslate(req, language);
  res.status(status).render(view, {
    ...data,
    title: data.title || translate(data.titleKey),
    pageTitle: data.pageTitle || translate(data.pageTitleKey),
    heading: data.heading || translate(data.headingKey),
    message: data.message || translate(data.messageKey),
    language,
    translate,
  });
}

function i18nTranslate(req, language) {
  if (req.i18n) {
    return req.i18n.getFixedT(language);
  }
  return (key) => key;
}

function copyLanguageHeaderForHtmlRequests(req, _res, next) {
  if (isHtmlRoute(req) && req.headers.language && (!req.headers["accept-language"] || req.headers["accept-language"] === "*")) {
    req.headers["accept-language"] = req.headers.language;
  }
  next();
}

function i18nForHtmlRequests(i18nInstance) {
  const middleware = i18nMiddleware(i18nInstance);
  return (req, res, next) => {
    if (!isHtmlRoute(req)) {
      next();
      return;
    }
    middleware(req, res, next);
  };
}

function isHtmlRoute(req) {
  return !req.path.startsWith("/hosted/") && !req.path.startsWith("/static/");
}
