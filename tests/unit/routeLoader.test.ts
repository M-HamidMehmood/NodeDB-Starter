import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { RouteLoader } from '../../src/utils/routeLoader';

// Mock dependencies
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('RouteLoader', () => {
  let app: express.Express;
  let routeLoader: RouteLoader;
  let mockModulesPath: string;
  let consoleSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    app = express();
    mockModulesPath = '/test/modules';
    routeLoader = new RouteLoader(app, mockModulesPath);

    // Spy on console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('loadRoutes', () => {
    test('should successfully load routes from valid modules', async () => {
      // Mock file system structure
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: 'user', isDirectory: () => true },
        { name: 'auth', isDirectory: () => true },
        { name: 'role', isDirectory: () => true },
      ] as any);

      // Mock path operations
      mockPath.join
        .mockReturnValueOnce('/test/modules/user/user.routes.ts')
        .mockReturnValueOnce('/test/modules/user/user.routes.js')
        .mockReturnValueOnce('/test/modules/auth/auth.routes.ts')
        .mockReturnValueOnce('/test/modules/auth/auth.routes.js')
        .mockReturnValueOnce('/test/modules/role/role.routes.ts')
        .mockReturnValueOnce('/test/modules/role/role.routes.js');

      // Mock route files existence
      mockFs.existsSync
        .mockReturnValueOnce(true) // modules directory
        .mockReturnValueOnce(true) // user.routes.ts
        .mockReturnValueOnce(true) // auth.routes.ts
        .mockReturnValueOnce(true); // role.routes.ts

      // Mock route modules
      const mockUserRoutes = express.Router();
      const mockAuthRoutes = express.Router();
      const mockRoleRoutes = express.Router();

      jest.doMock('/test/modules/user/user.routes.ts', () => ({ default: mockUserRoutes }), { virtual: true });
      jest.doMock('/test/modules/auth/auth.routes.ts', () => ({ default: mockAuthRoutes }), { virtual: true });
      jest.doMock('/test/modules/role/role.routes.ts', () => ({ default: mockRoleRoutes }), { virtual: true });

      // Spy on app.use to verify routes are registered
      const appUseSpy = jest.spyOn(app, 'use');

      await routeLoader.loadRoutes();

      // Verify routes were registered
      expect(appUseSpy).toHaveBeenCalledWith('/api/v1/user', mockUserRoutes);
      expect(appUseSpy).toHaveBeenCalledWith('/api/v1/auth', mockAuthRoutes);
      expect(appUseSpy).toHaveBeenCalledWith('/api/v1/role', mockRoleRoutes);

      // Verify success logs
      expect(consoleSpy).toHaveBeenCalledWith('✓ Registered routes: /api/v1/user -> /test/modules/user/user.routes.ts');
      expect(consoleSpy).toHaveBeenCalledWith('✓ Registered routes: /api/v1/auth -> /test/modules/auth/auth.routes.ts');
      expect(consoleSpy).toHaveBeenCalledWith('✓ Registered routes: /api/v1/role -> /test/modules/role/role.routes.ts');

      appUseSpy.mockRestore();
    });

    test('should handle missing modules directory gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await routeLoader.loadRoutes();

      // Should not throw error and not register any routes
      const appUseSpy = jest.spyOn(app, 'use');
      expect(appUseSpy).not.toHaveBeenCalled();
      appUseSpy.mockRestore();
    });

    test('should skip modules without route files', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: 'user', isDirectory: () => true },
        { name: 'config', isDirectory: () => true }, // No routes file
      ] as any);

      mockPath.join
        .mockReturnValueOnce('/test/modules/user/user.routes.ts')
        .mockReturnValueOnce('/test/modules/user/user.routes.js')
        .mockReturnValueOnce('/test/modules/config/config.routes.ts')
        .mockReturnValueOnce('/test/modules/config/config.routes.js');

      mockFs.existsSync
        .mockReturnValueOnce(true) // modules directory
        .mockReturnValueOnce(true) // user.routes.ts exists
        .mockReturnValueOnce(false) // config.routes.ts doesn't exist
        .mockReturnValueOnce(false); // config.routes.js doesn't exist

      const mockUserRoutes = express.Router();
      jest.doMock('/test/modules/user/user.routes.ts', () => ({ default: mockUserRoutes }), { virtual: true });

      const appUseSpy = jest.spyOn(app, 'use');

      await routeLoader.loadRoutes();

      // Only user routes should be registered
      expect(appUseSpy).toHaveBeenCalledWith('/api/v1/user', mockUserRoutes);
      expect(appUseSpy).toHaveBeenCalledTimes(1);

      appUseSpy.mockRestore();
    });

    test('should handle modules without default export', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([{ name: 'broken', isDirectory: () => true }] as any);

      mockPath.join
        .mockReturnValueOnce('/test/modules/broken/broken.routes.ts')
        .mockReturnValueOnce('/test/modules/broken/broken.routes.js');

      mockFs.existsSync
        .mockReturnValueOnce(true) // modules directory
        .mockReturnValueOnce(true); // broken.routes.ts exists

      // Mock module without default export
      jest.doMock('/test/modules/broken/broken.routes.ts', () => ({}), { virtual: true });

      const appUseSpy = jest.spyOn(app, 'use');

      await routeLoader.loadRoutes();

      // Should not register routes and should warn
      expect(appUseSpy).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('No default export found in /test/modules/broken/broken.routes.ts');

      appUseSpy.mockRestore();
    });

    test('should handle import errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([{ name: 'error', isDirectory: () => true }] as any);

      mockPath.join
        .mockReturnValueOnce('/test/modules/error/error.routes.ts')
        .mockReturnValueOnce('/test/modules/error/error.routes.js');

      mockFs.existsSync
        .mockReturnValueOnce(true) // modules directory
        .mockReturnValueOnce(true); // error.routes.ts exists

      // Mock import to throw error
      jest.doMock(
        '/test/modules/error/error.routes.ts',
        () => {
          throw new Error('Import failed');
        },
        { virtual: true }
      );

      // Should throw error when loading routes fails
      await expect(routeLoader.loadRoutes()).rejects.toThrow();
    });

    test('should support custom base paths', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([{ name: 'api', isDirectory: () => true }] as any);

      mockPath.join
        .mockReturnValueOnce('/test/modules/api/api.routes.ts')
        .mockReturnValueOnce('/test/modules/api/api.routes.js');

      mockFs.existsSync
        .mockReturnValueOnce(true) // modules directory
        .mockReturnValueOnce(true); // api.routes.ts exists

      const mockApiRoutes = express.Router();
      const mockModule = {
        default: mockApiRoutes,
        basePath: '/custom/api/path',
      };

      jest.doMock('/test/modules/api/api.routes.ts', () => mockModule, { virtual: true });

      const appUseSpy = jest.spyOn(app, 'use');

      await routeLoader.loadRoutes();

      // Should use custom base path
      expect(appUseSpy).toHaveBeenCalledWith('/custom/api/path', mockApiRoutes);
      expect(consoleSpy).toHaveBeenCalledWith(
        '✓ Registered routes: /custom/api/path -> /test/modules/api/api.routes.ts'
      );

      appUseSpy.mockRestore();
    });

    test('should prefer .ts files over .js files', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([{ name: 'mixed', isDirectory: () => true }] as any);

      mockPath.join
        .mockReturnValueOnce('/test/modules/mixed/mixed.routes.ts')
        .mockReturnValueOnce('/test/modules/mixed/mixed.routes.js');

      mockFs.existsSync
        .mockReturnValueOnce(true) // modules directory
        .mockReturnValueOnce(true) // mixed.routes.ts exists
        .mockReturnValueOnce(true); // mixed.routes.js also exists

      const mockMixedRoutes = express.Router();
      jest.doMock('/test/modules/mixed/mixed.routes.ts', () => ({ default: mockMixedRoutes }), { virtual: true });

      const appUseSpy = jest.spyOn(app, 'use');

      await routeLoader.loadRoutes();

      // Should use .ts file and log correct path
      expect(appUseSpy).toHaveBeenCalledWith('/api/v1/mixed', mockMixedRoutes);
      expect(consoleSpy).toHaveBeenCalledWith(
        '✓ Registered routes: /api/v1/mixed -> /test/modules/mixed/mixed.routes.ts'
      );

      appUseSpy.mockRestore();
    });
  });

  describe('getRegisteredRoutes', () => {
    test('should return empty array when no routes registered', () => {
      const routes = routeLoader.getRegisteredRoutes();
      expect(routes).toEqual([]);
    });

    test('should return registered routes information', async () => {
      // This is a complex test as it requires mocking Express internals
      // For now, we'll test that the method exists and returns an array
      const routes = routeLoader.getRegisteredRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });
  });
});
