import { Express, Router } from 'express';
import fs from 'fs';
import path from 'path';

type RouteModule = {
  default?: unknown;
  basePath?: string;
  router?: unknown;
};

function isRouter(candidate: unknown): candidate is Router {
  if (candidate === null || candidate === undefined) {
    return false;
  }
  if (typeof candidate === 'function') {
    return true;
  }
  if (typeof candidate === 'object' && 'use' in (candidate as Record<string, unknown>)) {
    const maybe = candidate as { use?: unknown };
    return typeof maybe.use === 'function';
  }
  return false;
}

/**
 * Automatically discovers and registers routes from modules
 */
export class RouteLoader {
  private app: Express;

  private modulesPath: string;

  constructor(app: Express, modulesPath: string = path.join(__dirname, '../modules')) {
    this.app = app;
    this.modulesPath = modulesPath;
  }

  /**
   * Load all routes from modules directory (async wrapper around sync load)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async loadRoutes(): Promise<void> {
    try {
      this.loadRoutesSync();
    } catch (error) {
      console.error('Error loading routes:', error);
      throw error;
    }
  }

  /**
   * Load all routes from modules directory synchronously
   */
  loadRoutesSync(): void {
    const modules = this.discoverModules();
    modules.forEach(moduleInfo => this.registerModuleSync(moduleInfo));
  }

  /**
   * Discover all modules with routes
   */
  private discoverModules(): Array<{ name: string; routePath: string }> {
    if (!fs.existsSync(this.modulesPath)) {
      return [];
    }

    const moduleDirectories = fs
      .readdirSync(this.modulesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    return moduleDirectories
      .map(moduleName => {
        const routeFile = path.join(this.modulesPath, moduleName, `${moduleName}.routes.ts`);
        const routeFileJs = path.join(this.modulesPath, moduleName, `${moduleName}.routes.js`);

        const hasTs = fs.existsSync(routeFile);
        if (hasTs) {
          return {
            name: moduleName,
            routePath: routeFile,
          };
        }

        const hasJs = fs.existsSync(routeFileJs);
        if (hasJs) {
          return {
            name: moduleName,
            routePath: routeFileJs,
          };
        }

        return null;
      })
      .filter((module): module is { name: string; routePath: string } => module !== null);
  }

  /**
   * Register a single module's routes (sync require)
   */
  private registerModuleSync(moduleInfo: { name: string; routePath: string }): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-dynamic-require, global-require
      const required = require(moduleInfo.routePath) as RouteModule;

      const basePath = required.basePath || `/api/v1/${moduleInfo.name}`;

      const defaultExport = (required as Record<string, unknown>).default;
      if (isRouter(defaultExport)) {
        this.app.use(basePath, defaultExport);
        console.log(`✓ Registered routes: ${basePath} -> ${moduleInfo.routePath}`);
        return;
      }

      if (isRouter(required.router)) {
        this.app.use(basePath, required.router);
        console.log(`✓ Registered routes: ${basePath} -> ${moduleInfo.routePath}`);
        return;
      }

      console.warn(`No default export found in ${moduleInfo.routePath}`);
    } catch (error) {
      console.error(`Failed to load routes from ${moduleInfo.routePath}:`, error);
      throw error;
    }
  }

  /**
   * Get all registered routes (for debugging)
   */
  getRegisteredRoutes(): Array<{ path: string; methods: string[] }> {
    console.log('Route inspection available via express-list-endpoints package');
    return [];
  }
}

export default RouteLoader;
