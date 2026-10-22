// The sheet a styled output attaches, `import styles from "./Card.uf.tsx.css?inline"` with
// `useStyles$(styles)` (ADR-0063): Vite's `?inline` import gives the sheet's text, which the
// checker resolves only through these declarations (ADR-0023).
declare module "*.css" {}

declare module "*.css?inline" {
  const sheet: string;
  export default sheet;
}
