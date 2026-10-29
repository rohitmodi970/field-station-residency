const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch monorepo root and shared packages
config.watchFolders = [monorepoRoot];

// 2. Resolve packages from both residency-campaign and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Custom resolver for @/ path alias
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  let targetModuleName = moduleName;
  if (targetModuleName.startsWith('@/')) {
    targetModuleName = path.resolve(projectRoot, targetModuleName.replace(/^@\//, ''));
  }
  if (originalResolver) {
    return originalResolver(context, targetModuleName, platform);
  }
  return context.resolveRequest(context, targetModuleName, platform);
};

module.exports = withNativeWind(config, { input: './app/global.css' });
