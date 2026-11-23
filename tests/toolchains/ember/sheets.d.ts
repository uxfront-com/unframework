// The sheet a styled output imports, `import "./Card.uf.tsx.css"` (ADR-0063): a side effect with
// no bindings, which the checker resolves only through this declaration (ADR-0023).
declare module "*.css" {}
