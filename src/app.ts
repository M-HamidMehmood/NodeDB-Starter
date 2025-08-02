import cookieParser from 'cookie-parser';
import 'dotenv/config';
import express from 'express';
import 'express-async-errors';
import fileUpload from 'express-fileupload';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '../config/config';
import errorMiddleware from './middlewares/error.middleware';
import { logger, RouteLoader } from './utils';

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

// Auto-load routes
const initializeRoutes = async () => {
  try {
    const routeLoader = new RouteLoader(app);
    await routeLoader.loadRoutes();
  } catch (error) {
    logger.error('Failed to load routes:', error);
    process.exit(1);
  }
};

initializeRoutes().catch(err => {
  console.error('Failed to initialize routes:', err);
  process.exit(1);
});

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
