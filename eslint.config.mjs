import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';

// ============================================================================
// ESLINT CONFIG - NEXT.JS 16.1.1 + REACT 19
// ============================================================================
// Application: Admin Dashboard BENEW (5 utilisateurs/jour)
// Date: Janvier 2026
// Architecture: Next.js 16 + Better Auth + Sentry + Cloudinary
// ============================================================================

const eslintConfig = defineConfig([
  // ===== 1. CONFIGURATION NEXT.JS COMPLÈTE =====
  // Inclut automatiquement :
  // - eslint-plugin-react (règles React)
  // - eslint-plugin-react-hooks (règles Hooks)
  // - @next/eslint-plugin-next (règles Next.js)
  // - Core Web Vitals optimisations
  ...nextVitals,

  // ===== 2. PRETTIER (doit être en dernier) =====
  // Désactive les règles ESLint qui entrent en conflit avec Prettier
  prettier,

  // ===== 3. RÈGLES PERSONNALISÉES =====
  {
    rules: {
      // ===== REACT =====
      'react/react-in-jsx-scope': 'off', // Pas nécessaire avec Next.js
      'react/prop-types': 'off', // On n'utilise pas PropTypes
      'react/jsx-props-no-spreading': 'off', // Spreading OK pour notre use case
      'react/forbid-dom-props': ['warn', { forbid: ['style'] }], // Encourager CSS modules
      'react/jsx-filename-extension': [1, { extensions: ['.js', '.jsx'] }],

      // ===== ESLINT CORE =====
      'no-unused-vars':
        process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      // 'no-console': // Décommenté si vous voulez bloquer console.log
      //   process.env.NODE_ENV === 'production'
      //     ? ['error', { allow: ['warn', 'error'] }]
      //     : 'off',

      // ===== NEXT.JS / ACCESSIBILITY =====
      'jsx-a11y/anchor-is-valid': 'off', // Next.js Link gère ça correctement

      // ===== PRETTIER =====
      'prettier/prettier': 'warn', // Afficher warnings mais ne pas bloquer

      // ===== RÈGLES ADDITIONNELLES (décommentez si besoin) =====

      // React Hooks exhaustive-deps
      // 'react-hooks/exhaustive-deps': 'error',

      // Pas d'index comme key
      // 'react/no-array-index-key': 'error',

      // Import order (nécessite eslint-plugin-import)
      // 'import/order': [
      //   'error',
      //   {
      //     groups: [
      //       'builtin',
      //       'external',
      //       'internal',
      //       'parent',
      //       'sibling',
      //       'index',
      //     ],
      //     'newlines-between': 'always',
      //   },
      // ],

      // Optimisation regex (nécessite eslint-plugin-optimize-regex)
      // 'optimize-regex/optimize-regex': 'warn',

      // Sécurité (nécessite eslint-plugin-security)
      // Déjà inclus si vous décommentez les plugins ci-dessous
    },

    settings: {
      react: {
        version: 'detect', // Détecte automatiquement la version de React
      },
      // Import resolver (nécessite eslint-plugin-import)
      // 'import/resolver': {
      //   alias: {
      //     map: [['@', './']],
      //     extensions: ['.js', '.jsx', '.json'],
      //   },
      // },
    },
  },

  // ===== 4. FICHIERS À IGNORER =====
  globalIgnores([
    // ===== Build outputs =====
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',

    // ===== Dependencies =====
    'node_modules/**',

    // ===== Config files =====
    'next-env.d.ts',
    '*.config.js',
    '*.config.mjs',
    '*.config.ts',

    // ===== Sentry =====
    '.sentry-build-info',
    'sentry.client.config.ts',
    'sentry.server.config.ts',
    'sentry.edge.config.ts',
    'instrumentation.js',
    'instrumentation-client.js',

    // ===== Cache & Logs =====
    '.turbo/**',
    '.cache/**',
    '*.log',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',

    // ===== Fichiers publics =====
    'public/**',
  ]),
]);

export default eslintConfig;

// ============================================================================
// NOTES DE CONFIGURATION
// ============================================================================
//
// PLUGINS INCLUS AUTOMATIQUEMENT VIA next/core-web-vitals :
// - eslint-plugin-react
// - eslint-plugin-react-hooks
// - @next/eslint-plugin-next
//
// PLUGINS ADDITIONNELS (décommentez si besoin) :
// Pour les activer, installez d'abord les packages :
//
// npm install --save-dev \
//   eslint-plugin-security \
//   eslint-plugin-import \
//   eslint-plugin-optimize-regex
//
// Puis décommentez les règles correspondantes dans la section "rules" ci-dessus.
//
// ============================================================================
// COMMANDES UTILES
// ============================================================================
//
// Linter tout le projet :
//   npm run lint
//
// Auto-fix les erreurs :
//   npm run lint:fix
//
// Linter un fichier spécifique :
//   npx eslint path/to/file.js
//
// Debug ESLint (voir quelle config s'applique) :
//   npx eslint --debug path/to/file.js
//
// Voir la config effective pour un fichier :
//   npx eslint --print-config path/to/file.js
//
// ============================================================================
