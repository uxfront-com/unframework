/**
 * The npm name of the package a `.uf.tsx` file imports the authoring API from, with its
 * `/config`, `/jsx-runtime` and `/jsx-dev-runtime` subpaths (ADR-0090). The analyser, the
 * catalogue and the CLI read it here, so a later rename changes this one line.
 */
export const AUTHORING_PACKAGE = "@uxfront/unframework";
