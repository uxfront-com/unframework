import { catalogue, docsUrl } from "./catalogue.ts";
import { strictPositions } from "./location.ts";
import type { Diagnostic, Severity, Span } from "./types.ts";

/** A SARIF 2.1.0 log (the subset Unframework writes). */
export interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: SarifRun[];
}

export interface SarifRun {
  tool: { driver: SarifDriver };
  columnKind: "utf16CodeUnits";
  results: SarifResult[];
}

export interface SarifDriver {
  name: string;
  informationUri: string;
  version?: string;
  rules: SarifRule[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { markdown: string; text: string };
  helpUri: string;
  defaultConfiguration: { level: SarifLevel };
}

export type SarifLevel = "error" | "warning" | "note";

export interface SarifRegion {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  charOffset: number;
  charLength: number;
}

/** Where a file is: a `file:` URI, or a URI relative to the `%SRCROOT%` base. */
export interface SarifArtifactLocation {
  uri: string;
  uriBaseId?: "%SRCROOT%";
}

export interface SarifLocation {
  physicalLocation: { artifactLocation: SarifArtifactLocation; region: SarifRegion };
  message?: { text: string };
}

export interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: SarifLocation[];
  relatedLocations?: SarifLocation[];
  fixes?: {
    description: { text: string };
    artifactChanges: {
      artifactLocation: SarifArtifactLocation;
      replacements: {
        deletedRegion: { charOffset: number; charLength: number };
        insertedContent: { text: string };
      }[];
    }[];
  }[];
  properties?: { target?: string; help?: string };
}

/** Options for {@link toSarif}. */
export interface SarifOptions {
  /** The Unframework version that produced the log. */
  version?: string;
}

/**
 * Converts diagnostics to a SARIF 2.1.0 log for code-scanning tools. `sources` must hold the
 * source of every diagnostic's file: a missing source, or a span outside its file, throws
 * instead of writing a wrong region.
 */
export function toSarif(
  diagnostics: readonly Diagnostic[],
  sources: ReadonlyMap<string, string>,
  options: SarifOptions = {},
): SarifLog {
  const position = strictPositions(sources, "toSarif");
  const region = (file: string, span: Span): SarifRegion => {
    const start = position(file, span.start);
    const end = position(file, span.end);
    return {
      startLine: start.line,
      startColumn: start.column,
      endLine: end.line,
      endColumn: end.column,
      charOffset: start.offset,
      charLength: end.offset - start.offset,
    };
  };
  const codes = [...new Set(diagnostics.map((diagnostic) => diagnostic.code))].sort();
  const rules = codes.map((code): SarifRule => {
    const entry = catalogue.get(code);
    return {
      id: code,
      name: entry?.name ?? code,
      shortDescription: { text: entry?.title ?? code },
      fullDescription: { markdown: entry?.description ?? "", text: entry?.description ?? "" },
      helpUri: docsUrl(code),
      defaultConfiguration: { level: level(entry?.severity ?? "error") },
    };
  });
  const results = diagnostics.map((diagnostic): SarifResult => {
    const artifact = artifactLocation(diagnostic.file);
    const result: SarifResult = {
      ruleId: diagnostic.code,
      level: level(diagnostic.severity),
      message: { text: diagnostic.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: artifact,
            region: region(diagnostic.file, diagnostic.span),
          },
        },
      ],
    };
    if (diagnostic.related?.length) {
      result.relatedLocations = diagnostic.related.map((related) => ({
        physicalLocation: {
          artifactLocation: artifact,
          region: region(diagnostic.file, related.span),
        },
        message: { text: related.message },
      }));
    }
    if (diagnostic.fixes?.length) {
      result.fixes = diagnostic.fixes.map((fix) => ({
        description: { text: `${fix.title} (${fix.confidence})` },
        artifactChanges: [
          {
            artifactLocation: artifact,
            replacements: fix.edits.map((edit) => ({
              deletedRegion: {
                charOffset: edit.span.start,
                charLength: edit.span.end - edit.span.start,
              },
              insertedContent: { text: edit.text },
            })),
          },
        ],
      }));
    }
    if (diagnostic.target || diagnostic.help) {
      result.properties = {};
      if (diagnostic.target) result.properties.target = diagnostic.target;
      if (diagnostic.help) result.properties.help = diagnostic.help;
    }
    return result;
  });
  const driver: SarifDriver = {
    name: "unframework",
    informationUri: "https://unframework.dev",
    rules,
  };
  if (options.version) driver.version = options.version;
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{ tool: { driver }, columnKind: "utf16CodeUnits", results }],
  };
}

/**
 * A file's SARIF location. An absolute path (POSIX, Windows or UNC) becomes a `file:` URI; a
 * relative one becomes a relative URI against `%SRCROOT%`, the checkout's root. Each path
 * segment is percent-encoded, so spaces, `#` and `?` stay part of the path.
 */
function artifactLocation(file: string): SarifArtifactLocation {
  const path = file.replaceAll("\\", "/");
  const drive = /^([A-Za-z]:)\//.exec(path);
  if (drive) return { uri: `file:///${drive[1]}/${encode(path.slice(3))}` };
  if (path.startsWith("//")) return { uri: `file:${encode(path)}` };
  if (path.startsWith("/")) return { uri: `file://${encode(path)}` };
  return { uri: encode(path), uriBaseId: "%SRCROOT%" };
}

/** Percent-encodes each segment of a `/`-separated path. */
function encode(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function level(severity: Severity): SarifLevel {
  return severity === "info" ? "note" : severity;
}
