import { buildApp, loadDotenv, readConfig } from "./config.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  loadDotenv();
  const config = readConfig();
  const app = await buildApp(config);

  app.listen(config.port, config.host, () => {
    console.log(`Serving JSON Schema Registry at http://${config.host}:${config.port}/catalog/`);
  });
}
