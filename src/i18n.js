import i18next from "i18next";
import FsBackend from "i18next-fs-backend";
import * as middleware from "i18next-http-middleware";
import path from "node:path";
import { fileURLToPath } from "node:url";

const supportedLanguages = ["en-US", "es-US"];
export const fallbackLanguage = "en-US";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Creates an isolated i18next instance backed by locale YAML files.
 *
 * @param {{ localesRoot?: string }} [options]
 * @returns {Promise<import("i18next").i18n>}
 */
export async function createI18n({ localesRoot = path.join(packageRoot, "locales") } = {}) {
  const instance = i18next.createInstance();
  await instance
    .use(FsBackend)
    .use(middleware.LanguageDetector)
    .init({
      fallbackLng: fallbackLanguage,
      supportedLngs: supportedLanguages,
      preload: supportedLanguages,
      ns: ["translation"],
      defaultNS: "translation",
      detection: {
        order: ["header"],
        lookupHeader: "accept-language",
        caches: false,
      },
      interpolation: {
        escapeValue: false,
      },
      backend: {
        loadPath: path.join(localesRoot, "{{lng}}", "{{ns}}.yml"),
      },
    });
  return instance;
}

/**
 * Creates Express middleware for the provided i18next instance.
 *
 * @param {import("i18next").i18n} i18n
 * @returns {import("express").RequestHandler}
 */
export function i18nMiddleware(i18n) {
  return middleware.handle(i18n);
}
