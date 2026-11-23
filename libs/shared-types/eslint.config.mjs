import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc'],
  },
  {
    // Generator output (npm run generate:contracts). The recursive trace schema
    // needs z.lazy((): any => …); we don't hand-edit generated files.
    files: ['src/generated/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
];
