export type DatabaseConfig = {
  username: string;
  password: string;
  database: string;
  host: string;
  dialect: string;
  logging?: boolean | ((sql: string) => void);
  pool?: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
  };
  dialectOptions?: {
    ssl?:
      | {
          require: boolean;
          rejectUnauthorized: boolean;
        }
      | false;
  };
};

export type EnvConfig = {
  NODE_ENV: string;
  PORT: number;
  ORIGIN: string;
  SALT_ROUNDS: number;
  JWT_SECRET: string;
  JWT_LIFETIME: string;
  LOG_LEVEL: string;
  EMAIL_HOST: string | undefined;
  EMAIL_PORT: number;
  EMAIL_USER: string | undefined;
  EMAIL_PASSWORD: string | undefined;
  EMAIL_FROM: string;
};

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  } | null;
};

// Environment configuration with defaults
export const env: EnvConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  ORIGIN: process.env.ORIGIN || 'http://localhost:3000',
  SALT_ROUNDS: parseInt(process.env.SALT_ROUNDS || '10', 10),

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'top_secret',
  JWT_LIFETIME: process.env.JWT_LIFETIME || '7d',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Email
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587', 10),
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@example.com',
};

// Database configuration for sequelize-cli
export const dbConfig: Record<string, DatabaseConfig> = {
  development: {
    username: process.env.DB_USERNAME || 'username',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'myapp_db',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging: false,
  },
  test: {
    username: process.env.TEST_DB_USERNAME || 'username',
    password: process.env.TEST_DB_PASSWORD || 'password',
    database: process.env.TEST_DB_NAME || 'myapp_db_test',
    host: process.env.TEST_DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging: false,
  },
  production: {
    username: process.env.PROD_DB_USERNAME || process.env.DB_USERNAME || 'username',
    password: process.env.PROD_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
    database: process.env.PROD_DB_NAME || 'myapp_db_production',
    host: process.env.PROD_DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging: false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      min: parseInt(process.env.DB_POOL_MIN || '0', 10),
      acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
      idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
    },
    dialectOptions: {
      ssl:
        process.env.DB_SSL === 'true'
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
    },
  },
};

// Email configuration
export const emailConfig: EmailConfig = {
  host: env.NODE_ENV === 'production' ? env.EMAIL_HOST || 'localhost' : 'localhost',
  port: env.NODE_ENV === 'production' ? env.EMAIL_PORT : 1025,
  secure: env.NODE_ENV === 'production',
  auth:
    env.NODE_ENV === 'production' && env.EMAIL_USER && env.EMAIL_PASSWORD
      ? {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASSWORD,
        }
      : null, // No auth needed for MailHog
};
