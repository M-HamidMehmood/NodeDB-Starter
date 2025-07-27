import { jest } from '@jest/globals';

// Mock users data
const mockUsers = new Map();
const mockRoles = new Map();
const mockPermissions = new Map();
const mockRolePermissions = new Map();

// Auto-increment counters
let userIdCounter = 1;
let roleIdCounter = 1;
let permissionIdCounter = 1;

// Initialize with default data
const initializeMockData = () => {
  mockRoles.clear();
  mockPermissions.clear();
  mockUsers.clear();
  mockRolePermissions.clear();

  // Default roles
  mockRoles.set(1, { id: 1, name: 'admin', title: 'Administrator', accessLevel: 'admin' });
  mockRoles.set(2, { id: 2, name: 'user', title: 'User', accessLevel: 'user' });
  mockRoles.set(3, { id: 3, name: 'moderator', title: 'Moderator', accessLevel: 'moderator' });

  // Default permissions
  mockPermissions.set(1, { id: 1, name: 'manage_users', description: 'Can manage all users' });
  mockPermissions.set(2, { id: 2, name: 'view_users', description: 'Can view user information' });

  // Default role permissions
  mockRolePermissions.set('1-1', { roleId: 1, permissionId: 1 });
  mockRolePermissions.set('1-2', { roleId: 1, permissionId: 2 });

  // Reset counters
  userIdCounter = 1;
  roleIdCounter = 4;
  permissionIdCounter = 3;
};

// Mock database operations
export const mockDatabase = {
  // Users
  users: {
    insert: jest.fn().mockImplementation((data) => {
      const user = { id: userIdCounter++, ...data };
      mockUsers.set(user.id, user);
      return { returning: jest.fn().mockResolvedValue([user]) };
    }),
    
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation((condition) => {
        const users = Array.from(mockUsers.values());
        // Simple mock implementation - return first match or all
        return Promise.resolve(users);
      }),
      limit: jest.fn().mockReturnThis(),
    })),

    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation((condition) => {
        return { returning: jest.fn().mockResolvedValue([mockUsers.get(1)]) };
      }),
    })),

    delete: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockResolvedValue(undefined),
    })),
  },

  // Roles
  roles: {
    insert: jest.fn().mockImplementation((data) => {
      const role = { id: roleIdCounter++, ...data };
      mockRoles.set(role.id, role);
      return { returning: jest.fn().mockResolvedValue([role]) };
    }),
    
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(mockRoles.values()));
      }),
    })),

    delete: jest.fn().mockResolvedValue(undefined),
  },

  // Permissions
  permissions: {
    insert: jest.fn().mockImplementation((data) => {
      const permission = { id: permissionIdCounter++, ...data };
      mockPermissions.set(permission.id, permission);
      return { returning: jest.fn().mockResolvedValue([permission]) };
    }),
    
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation(() => {
        return Promise.resolve([{ name: 'manage_users' }, { name: 'view_users' }]);
      }),
    })),

    delete: jest.fn().mockResolvedValue(undefined),
  },

  // Role Permissions
  rolePermissions: {
    insert: jest.fn().mockImplementation((data) => {
      const key = `${data.roleId}-${data.permissionId}`;
      mockRolePermissions.set(key, data);
      return { returning: jest.fn().mockResolvedValue([data]) };
    }),
    
    delete: jest.fn().mockResolvedValue(undefined),
  },

  // General operations
  insert: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Mock the database module
export const mockDb = {
  insert: jest.fn((table) => {
    if (table === mockDatabase.users) return mockDatabase.users.insert;
    if (table === mockDatabase.roles) return mockDatabase.roles.insert;
    if (table === mockDatabase.permissions) return mockDatabase.permissions.insert;
    if (table === mockDatabase.rolePermissions) return mockDatabase.rolePermissions.insert;
    return mockDatabase.insert;
  }),
  
  select: jest.fn(() => mockDatabase.select),
  update: jest.fn(() => mockDatabase.update),
  delete: jest.fn(() => mockDatabase.delete),
};

// Reset function for tests
export const resetMockDatabase = () => {
  initializeMockData();
  jest.clearAllMocks();
};

// Initialize mock data
initializeMockData();