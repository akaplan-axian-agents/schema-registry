import express from "express";
import { engine } from "express-handlebars";
import { createI18n, fallbackLanguage, i18nMiddleware } from "./i18n.js";
import {
  createSchemaManagementErrorHandler,
  createSchemaManagementNotFoundHandler,
  createSchemaManagementRouter,
} from "./schema-management.js";

export async function createRegistryApp({ store, staticRoot, viewsRoot, localesRoot, i18n = null }) {
  const app = express();
  const i18nInstance = i18n || (await createI18n({ localesRoot }));
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
  if (
    isHtmlRoute(req) &&
    req.headers.language &&
    (!req.headers["accept-language"] || req.headers["accept-language"] === "*")
  ) {
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
