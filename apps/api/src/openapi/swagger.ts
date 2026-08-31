import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export const SWAGGER_PATH = "docs";
export const OPENAPI_JSON_PATH = "docs/openapi.json";
export const OPENAPI_YAML_PATH = "docs/openapi.yaml";

export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle("Capela API")
    .setDescription(
      [
        "The backend API for Capela, an evidence-first AI molecule investigation agent.",
        "",
        "## Authentication",
        "Protected operations require a current Privy access token in `Authorization: Bearer <token>`. The API derives the user identity from the verified token; it never trusts a client-supplied user ID.",
        "",
        "## Investigation lifecycle",
        "Create an investigation, then poll its detail resource until `status` becomes `completed` or `failed`. Failed investigations can be retried through the retry operation. A completed response may contain the full eight-section scientific dossier.",
        "",
        "## Scientific contract",
        "Capela retrieves chemical and literature records before evidence extraction and synthesis. Evidence classifications distinguish direct and indirect experiments, computational predictions, literature reports, Capela inferences, and insufficient evidence.",
        "",
        "## Preview access",
        "Payments currently default to disabled. The access resource is authoritative: clients should only show a Base payment flow when `paymentsEnabled` and `paymentRequired` are both true.",
        "",
        "Errors always include `message`. Standard Nest validation/authentication errors also include `statusCode` and `error`; domain errors may instead include a stable machine-readable `code`.",
      ].join("\n"),
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Privy access token",
        description: "Paste the Privy access token. Swagger UI adds the Bearer prefix automatically.",
      },
      "privy",
    )
    .addTag("Health", "Service and MongoDB readiness")
    .addTag("Account", "Authenticated Capela profile and permanent account deletion")
    .addTag("Sessions", "API-observed Privy session inventory and revocation")
    .addTag("Access", "Current investigation allowance and payment requirement")
    .addTag("Investigations", "Create, inspect, list, retry, and delete molecule investigations")
    .addTag("Notifications", "Investigation-derived notifications")
    .addTag("Payments", "Server-side verification of Base transactions when payments are enabled")
    .build();
}

export function configureSwagger(app: INestApplication) {
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig(), {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, "").replace(/^./, (character) => character.toLowerCase())}.${methodKey}`,
  });

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: "Capela API Documentation",
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    yamlDocumentUrl: OPENAPI_YAML_PATH,
    swaggerOptions: {
      displayRequestDuration: true,
      docExpansion: "list",
      filter: true,
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  });

  return document;
}
