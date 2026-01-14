const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration for WISPTools.io
 * https://facebook.github.io/metro/docs/configuration
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // Resolve file extensions
    sourceExts: [...defaultConfig.resolver.sourceExts, 'json'],
    // Asset extensions
    assetExts: defaultConfig.resolver.assetExts.filter((ext) => ext !== 'svg'),
  },
  transformer: {
    // Suppress warnings and optimize
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  // Suppress watchman warnings
  watchFolders: [],
  // Reduce verbosity
  reporter: {
    update: () => {},
  },
};

module.exports = mergeConfig(defaultConfig, config);

