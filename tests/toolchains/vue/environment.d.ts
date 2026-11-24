// `process.env.NODE_ENV`, the development check a `if (isDev)` block compiles to (ADR-0117). An
// app has it from `@types/node` or its bundler's client types; this project sets `"types": []`,
// so it stands in for them here, and never in the output.
declare const process: { readonly env: { readonly NODE_ENV?: string } };
