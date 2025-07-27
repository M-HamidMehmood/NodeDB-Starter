import express from 'express';
import authenticateMiddleware from '../../middlewares/authenticate.middlware';
import authorizeMiddleware from '../../middlewares/authorize.middlware';
import * as userController from './user.controller';

const router = express.Router();

// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.get('/', authenticateMiddleware, authorizeMiddleware(['manage_users']), userController.getAllUsers);

// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.get('/me', authenticateMiddleware, userController.showCurrentUser);
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.get('/:id', authenticateMiddleware, userController.getSingleUser);

// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.put('/:id', authenticateMiddleware, userController.updateUser);

// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.post('/update-password', authenticateMiddleware, userController.updateUserPassword);

export default router;
