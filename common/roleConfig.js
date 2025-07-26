module.exports = {
  roles: {
    admin: {
      id: 1,
      name: 'admin',
      title: 'Administrator',
      description: 'Full access to all system features',
      accessLevel: 'all',
    },
    user: {
      id: 2,
      name: 'user',
      title: 'Standard User',
      description: 'Regular user with limited access',
      accessLevel: 'organization',
    },
  },
  permissions: {
    manage_users: {
      id: 1,
      name: 'manage_users',
      description: 'Permission to manage users',
    },
    view_content: {
      id: 2,
      name: 'view_content',
      description: 'Permission to view content',
    },
  },
  // Map which roles have which permissions
  rolePermissions: {
    admin: ['manage_users'],
    user: ['view_content'],
  },
};
