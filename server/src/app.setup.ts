import { INestApplication, ValidationPipe } from '@nestjs/common';

// Settings shared by the real server (main.ts) and the API tests
// (api.e2e-spec.ts), so the tests run against exactly the same setup.
export function configureApp(app: INestApplication): void {
  // Every route starts with /api. The Vite dev server forwards /api to here.
  app.setGlobalPrefix('api');

  // Checks every request body against its DTO class:
  // whitelist drops fields the DTO doesn't declare, forbidNonWhitelisted
  // rejects the request instead, and transform turns the JSON into the DTO class.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
