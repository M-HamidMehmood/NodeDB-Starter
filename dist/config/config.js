"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailConfig = exports.dbConfig = exports.env = void 0;
exports.env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    ORIGIN: process.env.ORIGIN || 'http://localhost:3000',
    SALT_ROUNDS: parseInt(process.env.SALT_ROUNDS || '10', 10),
    JWT_SECRET: process.env.JWT_SECRET || 'top_secret',
    JWT_LIFETIME: process.env.JWT_LIFETIME || '7d',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587', 10),
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@example.com',
};
exports.dbConfig = {
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
            ssl: process.env.DB_SSL === 'true'
                ? {
                    require: true,
                    rejectUnauthorized: false,
                }
                : false,
        },
    },
};
exports.emailConfig = {
    host: exports.env.NODE_ENV === 'production' ? exports.env.EMAIL_HOST || 'localhost' : 'localhost',
    port: exports.env.NODE_ENV === 'production' ? exports.env.EMAIL_PORT : 1025,
    secure: exports.env.NODE_ENV === 'production',
    auth: exports.env.NODE_ENV === 'production' && exports.env.EMAIL_USER && exports.env.EMAIL_PASSWORD
        ? {
            user: exports.env.EMAIL_USER,
            pass: exports.env.EMAIL_PASSWORD,
        }
        : null,
};
//# sourceMappingURL=config.js.map