/**
 * Ambient declarations for what a `.uf.tsx` file imports besides modules. Loaded through the
 * reference at the top of `unframework/jsx-runtime`, so no configuration is needed.
 */

/**
 * A component's scoped stylesheet: `import "./Button.css"` (plan §4.4). Side effect only: TypeScript
 * 7 checks side-effect imports (`noUncheckedSideEffectImports`), and there is nothing to import.
 */
declare module "*.css" {}
