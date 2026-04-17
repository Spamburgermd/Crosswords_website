// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Redirect expo-keep-awake to a no-op stub.
// The native module is not linked in this dev build and throws
// "Unable to activate keep awake" (unhandled promise rejection) from
// expo's internal withDevTools wrapper. The stub silences it cleanly.
config.resolver = config.resolver ?? {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'expo-keep-awake': path.resolve(__dirname, 'stubs/expo-keep-awake.js'),
};

module.exports = config;
