module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@src': './src',
            '@screens': './src/screens',
            '@components': './src/components',
            '@stores': './src/stores',
            '@ui': './src/ui',
            '@lib': './src/lib',
            '@schemas': './src/types',
            '@assets': './assets',
            '@hooks': './src/hooks',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
