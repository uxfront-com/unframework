import { describe, expect, it } from "vitest";

import {
  applyEdits,
  applyFixes,
  BANDS,
  catalogue,
  createDiagnostic,
  formatDiagnostic,
  formatDiagnostics,
  hasErrors,
  LineIndex,
  sortDiagnostics,
  toJsonDiagnostics,
  toSarif,
} from "../src/index.ts";
import type { Diagnostic } from "../src/index.ts";

const source = 'import { useState } from "react";\nexport default function Widget() {}\n';
const file = "Widget.uf.tsx";
const reactSpan = { start: source.indexOf('"react"'), end: source.indexOf('"react"') + 7 };

function frameworkImport(): Diagnostic {
  return createDiagnostic("UF1201", {
    file,
    span: reactSpan,
    message: '"react" is a React module, and components are framework-free.',
    help: 'Write the component with the authoring API from "unframework".',
  });
}

describe("catalogue", () => {
  it("documents every code with a name, a title and a description", () => {
    for (const [code, entry] of catalogue) {
      expect(entry.code).toBe(code);
      expect(code).toMatch(/^UF[1-9]\d{3}$/);
      expect(BANDS[code.slice(0, 3)], `${code} is in a known band`).toBeTruthy();
      expect(entry.name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("gives every code a unique name", () => {
    const names = [...catalogue.values()].map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("createDiagnostic", () => {
  it("takes the catalogue's severity", () => {
    expect(frameworkImport().severity).toBe("error");
  });

  it("reports an uncatalogued code as an internal error instead of throwing", () => {
    const diagnostic = createDiagnostic("UF9999", { file, span: reactSpan, message: "nope" });
    expect(diagnostic.code).toBe("UF9001");
    expect(diagnostic.message).toContain("UF9999");
    // A target's uncatalogued code stays that target's problem.
    expect(
      createDiagnostic("UF9999", { file, span: reactSpan, message: "nope", target: "vue" }).target,
    ).toBe("vue");
  });

  it("omits empty optional fields", () => {
    expect(
      Object.keys(createDiagnostic("UF1001", { file, span: reactSpan, message: "x" })),
    ).toEqual(["code", "severity", "message", "file", "span"]);
  });
});

describe("hasErrors and sortDiagnostics", () => {
  it("finds errors", () => {
    expect(hasErrors([frameworkImport()])).toBe(true);
    expect(hasErrors([{ ...frameworkImport(), severity: "warning" }])).toBe(false);
  });

  it("sorts by file, position, target and code", () => {
    const a = { ...frameworkImport(), span: { start: 5, end: 6 } };
    const b = { ...frameworkImport(), span: { start: 1, end: 2 } };
    const c = { ...frameworkImport(), file: "A.uf.tsx" };
    expect(sortDiagnostics([a, b, c])).toEqual([c, b, a]);
  });
});

describe("LineIndex", () => {
  it("maps offsets to 1-based lines and UTF-16 columns", () => {
    const index = new LineIndex("ab\ncd\r\nef\rgh");
    expect(index.position(0)).toEqual({ line: 1, column: 1, offset: 0 });
    expect(index.position(4)).toEqual({ line: 2, column: 2, offset: 4 });
    expect(index.position(7)).toEqual({ line: 3, column: 1, offset: 7 });
    expect(index.position(10)).toEqual({ line: 4, column: 1, offset: 10 });
    expect(index.line(2)).toBe("cd");
    expect(index.lineCount).toBe(4);
  });

  it("clamps offsets past the end", () => {
    expect(new LineIndex("ab").position(99)).toEqual({ line: 1, column: 3, offset: 2 });
  });
});

describe("formatDiagnostic", () => {
  it("renders a code frame with help and docs", () => {
    expect(formatDiagnostic(frameworkImport(), source)).toMatchInlineSnapshot(`
      "error[UF1201]: "react" is a React module, and components are framework-free.
       --> Widget.uf.tsx:1:26
        |
      1 | import { useState } from "react";
        |                          ^^^^^^^
        |
        = help: Write the component with the authoring API from "unframework".
        = see: https://unframework.dev/diagnostics/UF1201"
    `);
  });

  it("shows both ends of a multi-line span, related spans and fixes", () => {
    const diagnostic: Diagnostic = {
      ...frameworkImport(),
      span: { start: 0, end: source.indexOf("default") },
      related: [{ span: reactSpan, message: "imported here" }],
      fixes: [{ title: "Remove the import", confidence: "safe", edits: [] }],
      target: "react",
    };
    expect(formatDiagnostic(diagnostic, source, { docs: false })).toMatchInlineSnapshot(`
      "error[UF1201] (react): "react" is a React module, and components are framework-free.
       --> Widget.uf.tsx:1:1
        |
      1 | import { useState } from "react";
        | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      2 | export default function Widget() {}
        | ^^^^^^^
        |
      1 | import { useState } from "react";
        |                          ^^^^^^^ imported here
        |
        = help: Write the component with the authoring API from "unframework".
        = fix (safe): Remove the import"
    `);
  });

  it("falls back to the file name without a source", () => {
    expect(formatDiagnostic(frameworkImport(), undefined, { docs: false })).toBe(
      [
        'error[UF1201]: "react" is a React module, and components are framework-free.',
        " --> Widget.uf.tsx",
        '  = help: Write the component with the authoring API from "unframework".',
      ].join("\n"),
    );
  });

  it("colours only when asked", () => {
    expect(formatDiagnostic(frameworkImport(), source)).not.toContain("\u001B[");
    expect(formatDiagnostic(frameworkImport(), source, { color: true })).toContain("\u001B[1;31m");
  });

  // A file name is the caller's: it finds a source in a record's own keys only.
  it.each(["constructor", "toString", "__proto__"])(
    "finds no source for a file named %s",
    (name) => {
      const diagnostic = { ...frameworkImport(), file: name };
      expect(formatDiagnostics([diagnostic], {}, { docs: false })).toBe(
        formatDiagnostic(diagnostic, undefined, { docs: false }),
      );
      expect(formatDiagnostics([diagnostic], new Map([[name, source]]), { docs: false })).toBe(
        formatDiagnostic(diagnostic, source, { docs: false }),
      );
    },
  );
});

describe("toJsonDiagnostics", () => {
  it("resolves positions and links the docs", () => {
    const [json] = toJsonDiagnostics([frameworkImport()], new Map([[file, source]]));
    expect(json).toMatchObject({
      code: "UF1201",
      start: { line: 1, column: 26, offset: 25 },
      end: { line: 1, column: 33, offset: 32 },
      url: "https://unframework.dev/diagnostics/UF1201",
    });
  });

  // Clamping would record line 1, column 1 for every span, and the golden files would agree.
  it("throws instead of guessing when a file's source is missing", () => {
    expect(() => toJsonDiagnostics([frameworkImport()], new Map())).toThrow(
      'toJsonDiagnostics: no source for "Widget.uf.tsx"',
    );
  });

  it("throws on a span outside its file, and accepts one that ends at the end", () => {
    const outside = { ...frameworkImport(), span: { start: 5, end: source.length + 1 } };
    expect(() => toJsonDiagnostics([outside], new Map([[file, source]]))).toThrow(RangeError);
    const [json] = toJsonDiagnostics(
      [{ ...frameworkImport(), span: { start: source.length, end: source.length } }],
      new Map([[file, source]]),
    );
    expect(json!.end).toEqual({ line: 3, column: 1, offset: source.length });
  });
});

describe("toSarif", () => {
  it("writes a SARIF 2.1.0 log with rules, regions and fixes", () => {
    const diagnostic: Diagnostic = {
      ...frameworkImport(),
      fixes: [
        {
          title: "Remove the import",
          confidence: "likely",
          edits: [{ span: { start: 0, end: 34 }, text: "" }],
        },
      ],
    };
    const log = toSarif([diagnostic], new Map([[file, source]]), { version: "0.0.0" });
    expect(log.version).toBe("2.1.0");
    const run = log.runs[0]!;
    expect(run.tool.driver.rules.map((rule) => rule.id)).toEqual(["UF1201"]);
    expect(run.results[0]).toMatchObject({
      ruleId: "UF1201",
      level: "error",
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: file },
            region: { startLine: 1, startColumn: 26, charOffset: 25, charLength: 7 },
          },
        },
      ],
      fixes: [
        {
          artifactChanges: [
            { replacements: [{ deletedRegion: { charOffset: 0, charLength: 34 } }] },
          ],
        },
      ],
    });
  });

  it("maps info to SARIF's note level", () => {
    const log = toSarif([{ ...frameworkImport(), severity: "info" }], new Map([[file, source]]));
    expect(log.runs[0]!.results[0]!.level).toBe("note");
  });

  it("throws instead of guessing when a file's source is missing", () => {
    expect(() => toSarif([frameworkImport()], new Map())).toThrow(
      'toSarif: no source for "Widget.uf.tsx"',
    );
  });

  it.each([
    ["Widget.uf.tsx", { uri: "Widget.uf.tsx", uriBaseId: "%SRCROOT%" }, "/root/Widget.uf.tsx"],
    [
      "src/My Comp#1?.uf.tsx",
      { uri: "src/My%20Comp%231%3F.uf.tsx", uriBaseId: "%SRCROOT%" },
      "/root/src/My Comp#1?.uf.tsx",
    ],
    ["/abs/My Comp#1.uf.tsx", { uri: "file:///abs/My%20Comp%231.uf.tsx" }, "/abs/My Comp#1.uf.tsx"],
    [
      "C:\\work\\My Comp.uf.tsx",
      { uri: "file:///C:/work/My%20Comp.uf.tsx" },
      "/C:/work/My Comp.uf.tsx",
    ],
    ["\\\\server\\share\\A.uf.tsx", { uri: "file://server/share/A.uf.tsx" }, "/share/A.uf.tsx"],
  ])("writes %s as a URI that resolves to the file", (path, location, decoded) => {
    const log = toSarif([{ ...frameworkImport(), file: path }], new Map([[path, source]]));
    const { artifactLocation } = log.runs[0]!.results[0]!.locations[0]!.physicalLocation;
    expect(artifactLocation).toEqual(location);
    // A relative URI resolves against %SRCROOT% (here file:///root/) without losing a segment.
    const url = new URL(artifactLocation.uri, "file:///root/");
    expect(url.hash).toBe("");
    expect(url.search).toBe("");
    expect(decodeURIComponent(url.pathname)).toBe(decoded);
  });
});

describe("applyEdits", () => {
  it("applies edits against the original offsets", () => {
    expect(
      applyEdits("one two three", [
        { span: { start: 0, end: 3 }, text: "1" },
        { span: { start: 8, end: 13 }, text: "3" },
        { span: { start: 4, end: 4 }, text: ">" },
      ]),
    ).toBe("1 >two 3");
  });

  it("applies fixes", () => {
    expect(
      applyFixes("ab", [
        { title: "x", confidence: "safe", edits: [{ span: { start: 0, end: 1 }, text: "A" }] },
      ]),
    ).toBe("Ab");
  });

  it("rejects overlapping and out-of-range edits", () => {
    expect(() =>
      applyEdits("abc", [
        { span: { start: 0, end: 2 }, text: "" },
        { span: { start: 1, end: 3 }, text: "" },
      ]),
    ).toThrow(RangeError);
    expect(() => applyEdits("abc", [{ span: { start: 2, end: 9 }, text: "" }])).toThrow(RangeError);
  });
});
