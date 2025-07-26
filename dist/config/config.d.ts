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
        ssl?: {
            require: boolean;
            rejectUnauthorized: boolean;
        } | false;
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
export declare const env: EnvConfig;
export declare const dbConfig: Record<string, DatabaseConfig>;
export declare const emailConfig: EmailConfig;
//# sourceMappingURL=config.d.ts.map