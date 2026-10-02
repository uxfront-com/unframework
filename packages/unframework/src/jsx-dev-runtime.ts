/**
 * TypeScript resolves `<jsxImportSource>/jsx-dev-runtime` under `"jsx": "react-jsxdev"`. Unframework
 * sources use `"preserve"`, but tools that pick the dev transform must still find the same types.
 */
export type { JSX } from "./jsx-runtime.ts";
