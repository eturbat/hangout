import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Reads server/.env into process.env. This is built into Node, so we don't
// need the dotenv package. A deployed host has no .env file and sets real
// environment variables instead, so a missing file is fine.
function loadEnvFile(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function bootstrap(): Promise<void> {
  loadEnvFile();

  const app = await NestFactory.create(AppModule);

  // Every route starts with /api. The Vite dev server forwards /api to here.
  app.setGlobalPrefix('api');

  // Checks every request body against its DTO class:
  // whitelist drops fields the DTO doesn't declare, forbidNonWhitelisted
  // rejects the request instead, and transform turns the JSON into the DTO class.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // In development the frontend and API share one address through Vite's proxy,
  // so CORS isn't needed. Once the frontend is deployed separately, list its
  // address(es) in CORS_ORIGIN.
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin.split(',').map((origin) => origin.trim()) });
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`hangout server listening on http://localhost:${port}/api (try /api/health)`);
}

void bootstrap();
