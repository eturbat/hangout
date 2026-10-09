import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadEnvFile } from './env';

async function bootstrap(): Promise<void> {
  loadEnvFile();

  const app = await NestFactory.create(AppModule);

  // The /api prefix and request validation (shared with the API tests)
  configureApp(app);

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
