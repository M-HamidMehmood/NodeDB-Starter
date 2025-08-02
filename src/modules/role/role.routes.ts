import express from 'express';
import authenticateMiddleware from '../../middlewares/authenticate.middlware';
import authorizeMiddleware from '../../middlewares/authorize.middlware';
import * as roleController from './role.controller';

const router = express.Router();

// All role management endpoints require authentication and admin permissions
const requireAuth = authenticateMiddleware;
const requireAdmin = authorizeMiddleware(['manage_users', 'manage_roles']); // Allow both manage_users and a potential manage_roles permission

// GET /api/v1/role - Get all roles (with optional filtering, sorting, pagination)
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.get('/', requireAuth, requireAdmin, roleController.getAllRoles);

// GET /api/v1/role/permissions - Get all available permissions
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.get('/permissions', requireAuth, requireAdmin, roleController.getAllPermissions);

// GET /api/v1/role/:id - Get single role with permissions
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.get('/:id', requireAuth, requireAdmin, roleController.getRoleById);

// GET /api/v1/role/:id/stats - Get role statistics
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.get('/:id/stats', requireAuth, requireAdmin, roleController.getRoleStats);

// GET /api/v1/role/:id/users - Get users assigned to role
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.get('/:id/users', requireAuth, requireAdmin, roleController.getRoleUsers);

// POST /api/v1/role - Create new role
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.post('/', requireAuth, requireAdmin, roleController.createRole);

// POST /api/v1/role/:id/permissions - Assign multiple permissions to role
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.post('/:id/permissions', requireAuth, requireAdmin, roleController.assignPermissions);

// PUT /api/v1/role/:id - Update role
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.put('/:id', requireAuth, requireAdmin, roleController.updateRole);

// DELETE /api/v1/role/:id - Delete role
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.delete('/:id', requireAuth, requireAdmin, roleController.deleteRole);

// DELETE /api/v1/role/:id/permissions/:permissionId - Remove permission from role
// @ts-expect-error - Middleware type conflicts with AuthenticatedRequest
router.delete('/:id/permissions/:permissionId', requireAuth, requireAdmin, roleController.removePermission);

export default router;
