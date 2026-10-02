# @unframework/diagnostics

Diagnostics for the Unframework compiler (plan §5.9):

- **`Diagnostic`:** a stable `UF` code, a severity, a message, a span, related spans, help and
  machine-applicable fixes with a confidence (`safe` or `likely`). Passes report diagnostics; they
  never throw.
- **The catalogue:** every code, documented. Codes are grouped in bands (`UF1xxx` syntax and
  components, `UF2xxx` setup and macros, … `UF9xxx` internal) and are never reused.
- **Output:** `formatDiagnostic` renders a code frame for people; `toJsonDiagnostics` and `toSarif`
  serve agents and CI. Those two need the source of every diagnostic's file, and throw rather than
  write a position the file does not have; SARIF locations are `file:` URIs for absolute paths and
  `%SRCROOT%`-relative URIs otherwise, percent-encoded.
- **Fixes:** `applyEdits` and `applyFixes`.
