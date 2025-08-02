import { Express } from 'express';
import fs from 'fs';
import path from 'path';

interface RouteModule {
  default: unknown;
  basePath?: string;
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
   * Load all routes from modules directory
   */
  async loadRoutes(): Promise<void> {
    try {
      const modules = this.discoverModules();

      await Promise.all(modules.map(moduleInfo => this.registerModule(moduleInfo)));
    } catch (error) {
      console.error('Error loading routes:', error);
      throw error;
    }
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

        // Check for both .ts and .js files
        if (fs.existsSync(routeFile) || fs.existsSync(routeFileJs)) {
          return {
            name: moduleName,
            routePath: fs.existsSync(routeFile) ? routeFile : routeFileJs,
          };
        }
        return null;
      })
      .filter((module): module is { name: string; routePath: string } => module !== null);
  }

  /**
   * Register a single module's routes
   */
  private async registerModule(moduleInfo: { name: string; routePath: string }): Promise<void> {
    try {
      const routeModule = (await import(moduleInfo.routePath)) as RouteModule;

      if (!routeModule.default) {
        console.warn(`No default export found in ${moduleInfo.routePath}`);
        return;
      }

      // Use custom basePath or default to module name
      const basePath = routeModule.basePath || `/api/v1/${moduleInfo.name}`;

      this.app.use(basePath, routeModule.default);
      console.log(`✓ Registered routes: ${basePath} -> ${moduleInfo.routePath}`);
    } catch (error) {
      console.error(`Failed to load routes from ${moduleInfo.routePath}:`, error);
      throw error;
    }
  }

  /**
   * Get all registered routes (for debugging)
   */
  getRegisteredRoutes(): Array<{ path: string; methods: string[] }> {
    // This method is simplified to avoid complex type checking
    // For full route inspection, use express-list-endpoints package
    console.log('Route inspection available via express-list-endpoints package');
    return [];
  }
}

export default RouteLoader;
