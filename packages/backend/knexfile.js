const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })

module.exports = {
  development: {
    client: process.env.DATABASE_URL?.includes('sqlite') ? 'sqlite3' : 'postgresql',
    connection: process.env.DATABASE_URL?.includes('sqlite') 
      ? { filename: './dev.db' }
      : (process.env.DATABASE_URL || {
          host: 'localhost',
          port: 5432,
          database: 'saga_development',
          user: 'saga_user',
          password: 'saga_password',
        }),
    useNullAsDefault: true,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },

  test: {
    client: process.env.DATABASE_URL?.includes('sqlite') ? 'sqlite3' : 'postgresql',
    connection: process.env.DATABASE_URL?.includes('sqlite') 
      ? { filename: './test.db' }
      : (process.env.DATABASE_TEST_URL || {
          host: 'localhost',
          port: 5432,
          database: 'saga_test',
          user: 'saga_user',
          password: 'saga_password',
        }),
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 5,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 20,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },
}