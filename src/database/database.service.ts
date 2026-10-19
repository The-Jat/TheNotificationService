import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool, QueryResultRow } from 'pg';
import { config } from '../config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool = new Pool({ connectionString: config.databaseUrl, max: 5 });

  async onModuleInit() {
    await this.migrate();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pool.query<T>(sql, params as any[])).rows;
  }

  private async migrate() {
    const dir = join(__dirname, 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(727020)');
      await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const applied = new Set((await client.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
      for (const file of files) {
        if (applied.has(file)) continue;
        this.logger.log(`Applying migration ${file}`);
        await client.query('BEGIN');
        try {
          await client.query(readFileSync(join(dir, file), 'utf8'));
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(`Migration ${file} failed: ${err.message}`);
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(727020)').catch(() => undefined);
      client.release();
    }
  }
}

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
