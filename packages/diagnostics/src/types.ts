/** A half-open range `[start, end)` of UTF-16 offsets into a file. */
export interface Span {
  start: number;
  end: number;
}

/** How serious a diagnostic is. Only `error` stops a component from compiling. */
export type Severity = "error" | "warning" | "info";

/** A stable diagnostic code, such as `UF1201`. Codes are never reused. */
export type DiagnosticCode = `UF${number}`;

/** Replaces the text in `span` with `text`. An insertion has an empty span. */
export interface TextEdit {
  span: Span;
  text: string;
}

/** A machine-applicable fix: edits to the diagnostic's file. */
export interface Fix {
  title: string;
  edits: TextEdit[];
  /** `safe` fixes are applied by `unframework fix`; `likely` ones need a review. */
  confidence: "safe" | "likely";
}

/** A secondary location that explains a diagnostic. */
export interface RelatedInformation {
  span: Span;
  message: string;
}

/** A problem found in a source file. Passes report diagnostics; they never throw. */
export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** What is wrong here, in one sentence. */
  message: string;
  /** The file that `span` points into, as the caller named it. */
  file: string;
  span: Span;
  related?: RelatedInformation[];
  /** How to fix it, when the fix is not mechanical. */
  help?: string;
  fixes?: Fix[];
  /** Set for portability diagnostics: the target the problem applies to. */
  target?: string;
}
