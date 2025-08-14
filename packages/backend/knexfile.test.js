// Test-specific Knex configuration with SQLite fallback
const path = require('path');

const config = {
  test: {
    client: process.env.DB_CLIENT || 'sqlite3',
    connection: process.env.DATABASE_URL || {
      filename: path.join(__dirname, 'test.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './seeds'
    },
    pool: {
      min: 1,
      max: 5
    }
  },
  
  // PostgreSQL configuration for when available
  postgresql: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: 'localhost',
      port: 5432,
      user: process.env.USER || 'postgres',
      password: '',
      database: 'saga_test'
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './seeds'
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};

module.exports = config;