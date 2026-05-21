import i18next from "i18next";
import FsBackend from "i18next-fs-backend";
import middleware from "i18next-http-middleware";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const supportedLanguages = ["en-US", "es-US"];
export const fallbackLanguage = "en-US";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function createI18n({ localesRoot = path.join(packageRoot, "locales") } = {}) {
  const instance = i18next.createInstance();
  await instance.use(FsBackend).use(middleware.LanguageDetector).init({
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

export function i18nMiddleware(i18n) {
  return middleware.handle(i18n);
}
