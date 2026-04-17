import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openapiDocument = JSON.parse(
  readFileSync(path.join(__dirname, "openapi.json"), "utf8"),
);

export function mountSwagger(app) {
  app.get("/api-docs.json", (_req, res) => {
    res.json(openapiDocument);
  });

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openapiDocument, {
      customSiteTitle: "TIC4902 API",
    }),
  );
}
