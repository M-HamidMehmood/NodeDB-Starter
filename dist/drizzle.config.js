"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const drizzle_kit_1 = require("drizzle-kit");
exports.default = (0, drizzle_kit_1.defineConfig)({
    schema: './src/db/schema/*.ts',
    out: './src/db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/myapp_db',
    },
    verbose: true,
    strict: true,
    migrations: {
        table: 'drizzle_migrations',
        schema: 'public',
    },
});
//# sourceMappingURL=drizzle.config.js.map