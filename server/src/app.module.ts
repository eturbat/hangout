import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      // A factory, so the environment is read after main.ts has loaded .env.
      useFactory: () => ({
        type: 'postgres',
        // Default matches the nix-shell database: your login name, no password.
        url: process.env.DATABASE_URL ?? `postgres://${process.env.USER ?? 'postgres'}@localhost:5432/hangout`,
        // Entities that feature modules register with TypeOrmModule.forFeature()
        // are picked up automatically, so new modules don't need to touch this file.
        autoLoadEntities: true,
        // Creates and updates tables from the entities. Fine while developing;
        // a production database should use migrations instead.
        synchronize: process.env.NODE_ENV !== 'production',
      }),
    }),
  ],
})
export class AppModule {}
