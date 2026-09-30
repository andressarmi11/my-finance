import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  // scripts/ corre en Node (console, process), no en el browser.
  { ignores: ['dist', 'node_modules', 'scripts', 'preview-shots', 'supabase/functions/**/*.gen.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
  {
    // Estos dos plugins entraron después de una revisión que encontró, a
    // mano, cosas que ellos marcan solos: un efecto que consumía la URL
    // antes de que cargaran los datos, y formularios con <label> sin
    // asociar. Estaban apagados, y por eso pasaron.
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Accesibilidad: solo las que son errores reales, no preferencias.
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either' }],
      'jsx-a11y/no-autofocus': 'off', // el foco al abrir una hoja es a propósito
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/click-events-have-key-events': 'off', // los overlays cierran con Escape

      // Apagada a conciencia, no por comodidad. Marca el patrón "efecto
      // que lee la URL y abre un formulario" (el que usan los Atajos de
      // iOS) y "efecto que carga datos y los pone en estado". Los dos son
      // legítimos acá, están cubiertos por E2E, y reescribir los 7 sitios
      // para satisfacerla es un refactor con riesgo real sobre código que
      // funciona. Se vuelve a encender el día que esos flujos se muevan a
      // un router con loaders, que es donde el patrón sí sobra.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
);
