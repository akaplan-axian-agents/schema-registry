import express from "express";
import { engine } from "express-handlebars";
import { createI18n, fallbackLanguage, i18nMiddleware } from "./i18n.js";
import {
  createSchemaManagementErrorHandler,
  createSchemaManagementNotFoundHandler,
  createSchemaManagementRouter,
} from "./schema-management.js";

/**
 * Builds the Express application with schema storage, localization, templates,
 * and schema management routes wired together.
 *
 * @param {{
 *   store: import("./types.js").SchemaStore,
 *   staticRoot: string,
 *   viewsRoot: string,
 *   localesRoot: string,
 *   i18n?: import("i18next").i18n | null
 * }} options
 * @returns {Promise<import("express").Express>}
 */
export async function createRegistryApp({ store, staticRoot, viewsRoot, localesRoot, i18n = null }) {
  const app = express();
  const i18nInstance = i18n || (await createI18n({ localesRoot }));
  /** @type {import("./types.js").RenderFunction} */
  const renderView = (req, res, status, view, data) => render(req, res, status, view, data);

  app.locals.store = store;
  app.locals.staticRoot = staticRoot;
  app.locals.viewsRoot = viewsRoot;

  app.engine(
    "handlebars",
    engine({
      helpers: {
        t(key, options) {
          const language = options.data.root.language || fallbackLanguage;
          return i18nInstance.getFixedT(language)(key);
        },
      },
    }),
  );
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

  app.use(createSchemaManagementRouter({ store, render: renderView }));
  app.use(createSchemaManagementNotFoundHandler({ render: renderView }));
  app.use(createSchemaManagementErrorHandler({ render: renderView }));

  return app;
}

/**
 * Renders a template after filling common localized view fields.
 *
 * @param {import("./types.js").RegistryRequest} req
 * @param {import("express").Response} res
 * @param {number} status
 * @param {string} view
 * @param {import("./types.js").RenderData} data
 * @returns {void}
 */
function render(req, res, status, view, data) {
  const language = req.resolvedLanguage || req.language || fallbackLanguage;
  const translate = i18nTranslate(req, language);
  res.status(status).render(view, {
    ...data,
    title: data.title || translateOptional(translate, data.titleKey),
    pageTitle: data.pageTitle || translateOptional(translate, data.pageTitleKey),
    heading: data.heading || translateOptional(translate, data.headingKey),
    message: data.message || translateOptional(translate, data.messageKey),
    language,
    translate,
  });
}

/**
 * Returns the request-bound translator, or a key echo fallback before i18n runs.
 *
 * @param {import("./types.js").RegistryRequest} req
 * @param {string} language
 * @returns {(key: string) => string}
 */
function i18nTranslate(req, language) {
  if (req.i18n) {
    /** @type {(key: string) => string} */
    const translate = (key) => String(req.i18n.getFixedT(language)(key));
    return translate;
  }
  return (key) => key;
}

/**
 * Translates an optional localization key.
 *
 * @param {(key: string) => string} translate
 * @param {string | null | undefined} key
 * @returns {string}
 */
function translateOptional(translate, key) {
  if (key) {
    return translate(key);
  }
  return "";
}

/**
 * Copies the fallback Language header into Accept-Language for HTML routes.
 *
 * @param {import("./types.js").RegistryRequest} req
 * @param {import("express").Response} _res
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
function copyLanguageHeaderForHtmlRequests(req, _res, next) {
  if (
    isHtmlRoute(req) &&
    req.headers.language &&
    (!req.headers["accept-language"] || req.headers["accept-language"] === "*")
  ) {
    req.headers["accept-language"] = req.headers.language;
  }
  next();
}

/**
 * Wraps i18next middleware so hosted machine-readable assets skip localization.
 *
 * @param {import("i18next").i18n} i18nInstance
 * @returns {import("express").RequestHandler}
 */
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

/**
 * Detects whether a request should receive localized HTML behavior.
 *
 * @param {import("express").Request} req
 * @returns {boolean}
 */
function isHtmlRoute(req) {
  return !req.path.startsWith("/hosted/") && !req.path.startsWith("/static/");
}
