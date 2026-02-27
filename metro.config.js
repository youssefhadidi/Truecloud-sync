/** @format */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Disabling package exports resolution fixes the "getDevServer is not a function"
// error caused by @expo/metro-runtime being resolved to the wrong entry point.
config.resolver.unstable_enablePackageExports = false;

// axios's `main` field points to its Node.js bundle (which imports crypto, http,
// url, etc.). Override resolution to use the browser-compatible bundle instead.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'axios') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/axios/dist/browser/axios.cjs'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
