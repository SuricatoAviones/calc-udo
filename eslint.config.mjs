import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // La lógica de cálculo debe ser pura: nada de React ni de Next dentro de lib/.
    files: ['lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'next', 'next/*'],
              message: 'lib/ es lógica pura: no importes React ni Next.',
            },
            { group: ['@/components/*'], message: 'lib/ no puede depender de la UI.' },
          ],
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', '.agents/**', 'next-env.d.ts']),
]);

export default eslintConfig;
