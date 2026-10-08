import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

// GET /api/health: is the server up, and can it reach the database?
// A quick check after setup, and what a hosting service pings once deployed.
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<{ status: string; database: string }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('The server is running but cannot reach the database');
    }
    return { status: 'ok', database: 'up' };
  }
}
