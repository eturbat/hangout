import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

// A stand-in for TypeORM's DataSource, so the test needs no real database
function fakeDataSource(databaseWorks: boolean): DataSource {
  const query = async () => {
    if (!databaseWorks) throw new Error('connection refused');
    return [{ '?column?': 1 }];
  };
  return { query } as unknown as DataSource;
}

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    const controller = new HealthController(fakeDataSource(true));
    expect(await controller.check()).toEqual({ status: 'ok', database: 'up' });
  });

  it('answers 503 Service Unavailable when the database is unreachable', async () => {
    const controller = new HealthController(fakeDataSource(false));
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
