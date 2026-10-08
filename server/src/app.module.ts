import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // forRootAsync instead of forRoot: the factory runs while the app starts,
    // after main.ts has loaded .env. forRoot would read process.env too early.
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
        }
        return {
          type: 'postgres' as const,
          url,
          // Each feature module registers its own entities with
          // TypeOrmModule.forFeature([...]), so adding entities later
          // doesn't mean editing this file.
          autoLoadEntities: true,
          // Creates and updates tables from the entity classes. Handy while
          // developing; set DB_SYNCHRONIZE=false once the deployed database
          // holds data you care about.
          synchronize: process.env.DB_SYNCHRONIZE !== 'false',
        };
      },
    }),
    // EventsModule is added here in the events PR.
  ],
  controllers: [HealthController],
})
export class AppModule {}
