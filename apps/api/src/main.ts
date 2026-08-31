import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { allowedWebOrigins } from "./config/cors";
import { assertProductionEnvironment } from "./config/environment";

async function bootstrap() {
  assertProductionEnvironment(process.env);
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: allowedWebOrigins(process.env.WEB_ORIGIN), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
