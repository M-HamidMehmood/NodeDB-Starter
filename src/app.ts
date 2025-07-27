import cookieParser from 'cookie-parser';
import 'dotenv/config';
import express from 'express';
import 'express-async-errors';
import fileUpload from 'express-fileupload';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '../config/config';
import errorMiddleware from './middlewares/error.middleware';
import { logger } from './utils';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';

// Swagger UI setup
// import swaggerUi from 'swagger-ui-express';
// import openapiDocument from '../docs/openapi.json';

const app = express();

// Middlewares
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(cookieParser(env.JWT_SECRET));
app.use(fileUpload());

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Global error handler
app.use(errorMiddleware);

// Start the server if not imported by tests
if (require.main === module) {
  const PORT = env.PORT || 3000;
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
}

export default app;
