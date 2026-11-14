// The Node half of L10, ported from the screenshot spike: one browser command, `ufVisualCapture`,
// audits the fonts, captures a stable PNG, compares geometry and computed styles first and
// pixels second, and owns the write policy (the screenshot ADR):
//
//   baseline  (CI, the baseline environment) the committed __expected__/geometry.<name>.json
//             and __screenshots__/<name>-chromium-linux.png are the expectation. In update mode
//             (`pnpm test:baselines`) only the reference target writes them, and only in the
//             baseline environment (BASELINE_ENVIRONMENT); every other target compares against
//             the reference's capture from this run.
//   live      (elsewhere) nothing committed applies: the reference's capture from this run is
//             the expectation (it runs first: sequence.groupOrder), and nothing is written.
//
// Geometry follows the pixel mode, like the PNG: with --font-render-hinting=none text measures
// the same on macOS and Linux, but form controls do not (a text input's intrinsic width is
// 160px on macOS and 200px on Linux), so committed geometry is a Linux baseline too.
import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import pixelmatch from "pixelmatch";
import type { CDPSession, Page } from "playwright";
import { PNG } from "pngjs";

import { caseReference } from "../harness.ts";
import type { HarnessContext } from "../harness.ts";
import type {
  CaptureAttachment,
  CaptureOutcome,
  CaptureRequest,
  CaptureResult,
  GeometryDelta,
  GeometrySnapshot,
} from "../visual-types.ts";
import { caseDirectory, displayRoot, projectHarness } from "./context.ts";
import type { CommandProject } from "./context.ts";
import { specFinished } from "./finished.ts";
import { BASELINE_ENVIRONMENT } from "./mode.ts";
import { KEBAB_CASE } from "./names.ts";
import { writeIfChanged } from "./policy.ts";

export type { GeometryDelta } from "../visual-types.ts";

/** The font file's internal family name that CDP reports for the bundled "UF Test Sans". */
export const ALLOWED_FONTS: readonly string[] = ["Inter"];

/** Baseline PNGs are named after the browser and the platform that produced them. */
const BROWSER = "chromium";
const BASELINE_PLATFORM = "linux";

/** A project of the run, as the visual command looks for the reference's browser project. */
interface RunProject {
  name: string;
  config: { browser?: { enabled?: boolean } };
  getProvidedContext(): { target?: string };
}

/** What the visual command needs from Vitest's command context (Playwright provider). */
export interface VisualCommandContext extends CommandProject {
  project: CommandProject["project"] & {
    /** The run's projects, after `--project`: whether the reference's browser project is in it. */
    vitest?: { projects: readonly RunProject[] };
  };
  page: Page;
  iframe: { locator(selector: string): PlaywrightLocatorLike };
}

interface PlaywrightLocatorLike {
  screenshot(options: {
    animations: "disabled";
    caret: "hide";
    scale: "css";
    type: "png";
    timeout: number;
  }): Promise<Buffer>;
}

interface ReferenceCapture {
  png: string;
  geometry: GeometrySnapshot;
}

/**
 * Per process: the reference's captures in this run, by run, case and scenario. Commands run in
 * Vitest's main process, so every browser project of a run shares this.
 */
const STATE = Symbol.for("unframework.visual.references");

function references(): Map<string, ReferenceCapture> {
  const store = globalThis as { [STATE]?: Map<string, ReferenceCapture> };
  return (store[STATE] ??= new Map());
}

const cdpSessions = new WeakMap<Page, Promise<CDPSession>>();

/**
 * Where one capture's expectations and evidence live, and what its messages call it: a corpus
 * case's scenario ({@link caseCaptureLocation}), or a project's example (`@unframework.dev/visual`,
 * ADR-0087). L10's policy and comparison are the same for both.
 */
export interface CaptureLocation {
  /** Identifies the scenario among the run's captures: the reference's capture is kept under it. */
  key: string;
  /** What messages call the scenario, such as `basics/hello/initial`. */
  label: string;
  /** The case whose spec file captures it: whether the reference finished it (ADR-0091). */
  case: string;
  /** The target whose capture is the expectation: it publishes or writes, the others compare. */
  reference: string;
  /** The committed Linux screenshot. */
  baselinePng: string;
  /** The committed geometry and computed styles. */
  geometry: string;
  /** Where the reference publishes its capture with live pixels. */
  livePng: string;
  /** Where a failed comparison leaves its reference, actual and diff images and its geometry. */
  diffs: string;
  /** Where every capture of this target is written, a passing one too; none by default. */
  capture?: string;
  /** The command that writes the committed baselines, which a refusal or a missing one names. */
  baselineCommand: string;
}

/** A case's scenario as L10 locates it: the case's `__screenshots__/` and `__expected__/`. */
export function caseCaptureLocation(
  harness: HarnessContext,
  caseId: string,
  name: string,
  target: string,
): CaptureLocation {
  const caseDir = caseDirectory(harness, caseId);
  return {
    key: `${caseId}/${name}`,
    label: `${caseId}/${name}`,
    case: caseId,
    // The case's reference (ADR-0057) publishes or writes its pixels; every other target compares.
    reference: caseReference(harness, caseId),
    baselinePng: join(caseDir, "__screenshots__", baselineFileName(name)),
    geometry: join(caseDir, "__expected__", `geometry.${name}.json`),
    livePng: join(harness.liveDir, caseId, `${name}.png`),
    diffs: join(harness.diffsDir, caseId, `${name}.${target}`),
    baselineCommand: "pnpm test:baselines",
  };
}

/** A baseline PNG's file name: the scenario, then the browser and platform that produced it. */
export function baselineFileName(name: string): string {
  return `${name}-${BROWSER}-${BASELINE_PLATFORM}.png`;
}

/** `ufVisualCapture`: the L10 command. */
export async function ufVisualCapture(
  context: VisualCommandContext,
  request: CaptureRequest,
): Promise<CaptureResult> {
  const { target, harness } = projectHarness(context);
  const location = caseCaptureLocation(harness, request.case, request.name, target);
  if (!KEBAB_CASE.test(request.name)) {
    throw new Error(`[uf:visual] "${request.name}" is not a kebab-case scenario name.`);
  }
  return captureAt(context, request, location);
}

/**
 * L10 at a location: audits the fonts, captures a stable PNG, then publishes, writes or compares
 * it under the run's policy. The corpus's command and a project's examples both run it.
 */
export async function captureAt(
  context: VisualCommandContext,
  request: CaptureRequest,
  location: CaptureLocation,
): Promise<CaptureResult> {
  const { target, harness } = projectHarness(context);
  if (request.tolerance && !request.tolerance.reason.trim()) {
    throw new Error(`[uf:visual] ${location.label}: a tolerance needs a reason.`);
  }
  const root = displayRoot(harness);
  const rel = (file: string) => relative(root, file).split(sep).join("/");
  const reference = location.reference;
  const isReference = target === reference;
  const mode = `${harness.update ? "update" : "check"}+${harness.pixels}`;
  const key = `${harness.runId}:${location.key}`;
  const paths = {
    baselinePng: location.baselinePng,
    geometry: location.geometry,
    livePng: location.livePng,
    diffs: location.diffs,
  };
  // Set once the capture is written where the location keeps every capture.
  let captured = false;
  const done = (
    result: Pick<CaptureResult, "pass" | "outcome" | "message"> & Partial<CaptureResult>,
  ): CaptureResult => ({
    mode,
    role: isReference ? "reference" : "follower",
    attachments: [],
    ...(location.capture && captured ? { capture: location.capture } : {}),
    ...result,
  });

  // 1. Fonts: text rendered with anything but the bundled font fails before any comparison.
  //    Only Chromium can audit them (FONT_AUDIT_SKIP, ADR-0066). A project that opts in lets any
  //    font draw a live capture, which every target renders on this machine in this run, but
  //    never a baseline, which another machine compares with (ADR-0105).
  const anyFont = harness.pixels === "live" && harness.liveFonts === "any";
  const fontViolations =
    harness.browser === "chromium" && !anyFont ? await fontAudit(context.page, request.marker) : [];
  if (fontViolations.length) {
    return done({
      pass: false,
      outcome: "font-fallback",
      message: `Text rendered with a font outside the bundle:\n  ${fontViolations.join("\n  ")}`,
    });
  }

  // 2. A stable capture.
  const png = await stableCapture(context, request);
  if (!png) {
    return done({
      pass: false,
      outcome: "unstable",
      message: "Could not capture two identical consecutive screenshots.",
    });
  }
  const geometryJson = `${JSON.stringify(request.geometry, null, 2)}\n`;
  if (location.capture) {
    writeIfChanged(location.capture, png);
    captured = true;
  }

  // 3. The reference publishes its capture (live), or writes the baselines (update, in the
  //    baseline environment).
  if (isReference && harness.pixels === "live") {
    writeIfChanged(paths.livePng, png);
    references().set(key, { png: paths.livePng, geometry: request.geometry });
    return done({
      pass: true,
      outcome: "published-reference",
      message: "The reference's capture is this run's expectation (live).",
    });
  }
  if (isReference && harness.update) {
    // resolveHarnessMode refuses this combination elsewhere; the check here keeps a hand-built
    // context from writing a host's render under the Linux name.
    if (harness.baselineEnvironment !== BASELINE_ENVIRONMENT) {
      return done({
        pass: false,
        outcome: "refused-write",
        message: `Refusing to write ${rel(paths.geometry)} and ${rel(paths.baselinePng)}: the committed baselines come from ${BASELINE_ENVIRONMENT} (\`${location.baselineCommand}\`), and this run is in ${harness.baselineEnvironment ?? "another environment"}.`,
      });
    }
    writeIfChanged(paths.geometry, geometryJson);
    writeIfChanged(paths.baselinePng, png);
    references().set(key, { png: paths.baselinePng, geometry: request.geometry });
    return done({
      pass: true,
      outcome: "wrote-reference",
      message: `wrote ${rel(paths.geometry)} and ${rel(paths.baselinePng)}`,
    });
  }

  // 4. What this capture is compared against: the reference's capture from this run, or the
  //    committed baselines.
  const fromReference = harness.pixels === "live" || harness.update;
  const geometryAgainst = fromReference
    ? `${reference}'s capture in this run`
    : rel(paths.geometry);
  let expectedGeometry: GeometrySnapshot;
  let expectedPng: string;
  if (fromReference) {
    const fromThisRun = references().get(key);
    if (!fromThisRun) {
      writeIfChanged(join(paths.diffs, "actual.png"), png);
      // The reference's browser project is in the run but never finished this case's spec
      // file: its connection closed, and Vitest dropped the rest of its queue (ADR-0091).
      // Nothing was compared, and the summary names that project's failure once. A reference
      // filtered out of the run, or one that finished the case without capturing this
      // scenario, stays a failure of this cell.
      const referenceProject = browserProjectOf(context, reference);
      if (
        referenceProject !== undefined &&
        !specFinished(harness.runId, reference, location.case)
      ) {
        return done({
          pass: false,
          outcome: "reference-not-run",
          referenceProject,
          message: `The reference's browser project (${referenceProject}) did not finish ${location.case}'s spec file in this run, so ${location.label} has nothing to compare with.`,
        });
      }
      return done({
        pass: false,
        outcome: "missing-reference-capture",
        message: missingReference(reference, location.label, harness.update ? "update" : "live"),
      });
    }
    expectedGeometry = fromThisRun.geometry;
    expectedPng = fromThisRun.png;
  } else {
    const missing = [paths.geometry, paths.baselinePng].filter((file) => !existsSync(file));
    if (missing.length) {
      writeIfChanged(join(paths.diffs, "geometry.actual.json"), geometryJson);
      writeIfChanged(join(paths.diffs, "actual.png"), png);
      return done({
        pass: false,
        outcome: "missing-artefact",
        message: `Missing artefact ${missing.map(rel).join(" and ")}. Run \`${location.baselineCommand}\` to write it (the reference target, ${reference}, in the Linux image).`,
      });
    }
    expectedGeometry = JSON.parse(readFileSync(paths.geometry, "utf8")) as GeometrySnapshot;
    expectedPng = paths.baselinePng;
  }

  // 5. Geometry and computed styles first: a delta there explains a pixel difference.
  const geometryDiff = diffGeometry(expectedGeometry, request.geometry);

  // 6. Pixels: exact RGBA equality unless the case declares a tolerance with a reason.
  const actual = PNG.sync.read(png);
  const expectedBuffer = readFileSync(expectedPng);
  const expected = PNG.sync.read(expectedBuffer);
  const against = rel(expectedPng);
  const attachments: CaptureAttachment[] = [];
  const recordFailure = (diff?: PNG) => {
    const images: [CaptureAttachment["name"], Uint8Array, PNG][] = [
      ["reference", expectedBuffer, expected],
      ["actual", png, actual],
    ];
    if (diff) images.push(["diff", PNG.sync.write(diff), diff]);
    for (const [name, buffer, image] of images) {
      const file = join(paths.diffs, `${name}.png`);
      writeIfChanged(file, buffer);
      attachments.push({ name, path: file, width: image.width, height: image.height });
    }
    writeIfChanged(join(paths.diffs, "geometry.actual.json"), geometryJson);
  };

  if (expected.width !== actual.width || expected.height !== actual.height) {
    recordFailure();
    return done({
      pass: false,
      outcome: geometryDiff.length ? "geometry-mismatch" : "size-mismatch",
      message: [
        ...formatGeometryDiff(geometryDiff, geometryAgainst),
        `The capture is ${actual.width}×${actual.height}px; ${against} is ${expected.width}×${expected.height}px.`,
      ].join("\n"),
      attachments,
      deltas: geometryDiff,
    });
  }
  const diffPixels = countDifferentPixels(expected.data, actual.data);
  const allowed = request.tolerance?.maxDiffPixels ?? 0;
  if (geometryDiff.length || diffPixels > allowed) {
    // pixelmatch only draws the diff image; the count above is exact RGBA equality.
    const diff = new PNG({ width: actual.width, height: actual.height });
    pixelmatch(expected.data, actual.data, diff.data, actual.width, actual.height, {
      threshold: 0,
      includeAA: true,
      alpha: 0.2,
    });
    recordFailure(diff);
    return done({
      pass: false,
      outcome: geometryDiff.length ? "geometry-mismatch" : "pixel-mismatch",
      diffPixels,
      message: [
        ...formatGeometryDiff(geometryDiff, geometryAgainst),
        `${diffPixels} pixel(s) differ from ${against} (allowed: ${allowed}${request.tolerance ? `, because ${request.tolerance.reason}` : ""}).`,
      ].join("\n"),
      attachments,
      deltas: geometryDiff,
    });
  }
  const outcome: CaptureOutcome = diffPixels ? "matched-within-tolerance" : "matched";
  return done({
    pass: true,
    outcome,
    diffPixels,
    message: diffPixels
      ? `${diffPixels} pixel(s) differ, within tolerance: ${request.tolerance?.reason}`
      : "",
  });
}

/** Captures until two consecutive screenshots are byte-identical (up to 11 captures). */
async function stableCapture(
  context: VisualCommandContext,
  request: CaptureRequest,
): Promise<Buffer | undefined> {
  const locator = context.iframe.locator(request.element.selector);
  const shoot = () =>
    locator.screenshot({
      animations: "disabled",
      caret: "hide",
      scale: "css",
      type: "png",
      timeout: 5_000,
    });
  let previous = await shoot();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const next = await shoot();
    if (next.equals(previous)) return next;
    previous = next;
  }
  return undefined;
}

/** The part of a CDP `DOM.Node` the font audit reads. */
interface CdpNode {
  nodeId: number;
  nodeType: number;
  localName?: string;
  /** Name, value, name, value… */
  attributes?: string[];
  pseudoType?: string;
  children?: CdpNode[];
  shadowRoots?: CdpNode[];
  pseudoElements?: CdpNode[];
  contentDocument?: CdpNode;
}

/**
 * Lists every font Chromium used for text under the capture container that is not an allowed
 * web font. CDP reports the font file's internal family name, so the bundled "UF Test Sans" is
 * allowed as "Inter" plus `isCustomFont`.
 *
 * It walks the pierced DOM tree, so it reaches what a selector cannot: user-agent shadow roots
 * (a `<textarea>`'s text, an `<input>`'s value and placeholder) and generated content
 * (`::before`, `::after`, a list marker).
 */
async function fontAudit(page: Page, marker: string): Promise<string[]> {
  let session = cdpSessions.get(page);
  if (!session) {
    session = (async () => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("DOM.enable");
      await cdp.send("CSS.enable");
      return cdp;
    })();
    cdpSessions.set(page, session);
  }
  const cdp = await session;
  // The tests run in an iframe of the orchestrator page: pierce into its documents.
  const { root } = (await cdp.send("DOM.getDocument", { depth: -1, pierce: true })) as {
    root: CdpNode;
  };
  const containers: CdpNode[] = [];
  const find = (node: CdpNode) => {
    const attributes = node.attributes ?? [];
    for (let index = 0; index < attributes.length; index += 2) {
      if (attributes[index] === "data-uf-capture" && attributes[index + 1] === marker) {
        containers.push(node);
        return;
      }
    }
    for (const child of [
      ...(node.children ?? []),
      ...(node.shadowRoots ?? []),
      ...(node.contentDocument ? [node.contentDocument] : []),
    ]) {
      find(child);
    }
  };
  find(root);
  if (!containers.length)
    throw new Error(`[uf:visual] The font audit could not find the capture container ${marker}.`);

  // Every element under the container, with the element a reader would name for it: a node in
  // a user-agent shadow root is its host's rendering, a pseudo-element its owner's.
  const elements: { nodeId: number; label: string }[] = [];
  const collect = (node: CdpNode, host: string | undefined) => {
    let label = host;
    if (node.nodeType === 1) {
      label = node.pseudoType ? `${host}::${node.pseudoType}` : (host ?? `<${node.localName}>`);
      elements.push({ nodeId: node.nodeId, label });
    }
    for (const child of node.children ?? []) collect(child, host);
    for (const shadow of node.shadowRoots ?? []) collect(shadow, label);
    for (const pseudo of node.pseudoElements ?? []) collect(pseudo, label);
  };
  for (const container of containers) collect(container, undefined);

  const violations = new Set<string>();
  for (const { nodeId, label } of elements) {
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    for (const font of fonts) {
      if (font.isCustomFont && ALLOWED_FONTS.includes(font.familyName)) continue;
      violations.add(
        `${label} rendered ${font.glyphCount} glyph(s) with "${font.familyName}"${font.isCustomFont ? "" : " (system font)"}`,
      );
    }
  }
  return [...violations];
}

/** The name of a target's browser project in this run, or none when the run leaves it out. */
function browserProjectOf(context: VisualCommandContext, target: string): string | undefined {
  return context.project.vitest?.projects.find(
    (project) =>
      project.config.browser?.enabled === true && project.getProvidedContext().target === target,
  )?.name;
}

function missingReference(reference: string, key: string, why: string): string {
  return `The reference target (${reference}) did not capture ${key} earlier in this run (${why}). The reference runs first (sequence.groupOrder) and must not be filtered out with --project.`;
}

function countDifferentPixels(a: Uint8Array, b: Uint8Array): number {
  let count = 0;
  for (let index = 0; index < a.length; index += 4) {
    if (
      a[index] !== b[index] ||
      a[index + 1] !== b[index + 1] ||
      a[index + 2] !== b[index + 2] ||
      a[index + 3] !== b[index + 3]
    ) {
      count += 1;
    }
  }
  return count;
}

/** Every box and computed-style difference, by element path. */
export function diffGeometry(
  expected: GeometrySnapshot,
  actual: GeometrySnapshot,
): GeometryDelta[] {
  const deltas: GeometryDelta[] = [];
  const paths = new Set([...Object.keys(expected.nodes), ...Object.keys(actual.nodes)]);
  for (const path of [...paths].sort()) {
    const e = expected.nodes[path];
    const a = actual.nodes[path];
    if (!e || !a) {
      deltas.push({
        path,
        property: "(node)",
        expected: e ? "present" : "absent",
        actual: a ? "present" : "absent",
      });
      continue;
    }
    if (JSON.stringify(e.box) !== JSON.stringify(a.box)) {
      deltas.push({ path, property: "box", expected: e.box, actual: a.box });
    }
    const properties = new Set([...Object.keys(e.style ?? {}), ...Object.keys(a.style ?? {})]);
    for (const property of [...properties].sort()) {
      if (e.style?.[property] !== a.style?.[property]) {
        deltas.push({ path, property, expected: e.style?.[property], actual: a.style?.[property] });
      }
    }
  }
  return deltas;
}

/** Geometry deltas as message lines, the first `limit` of them. */
export function formatGeometryDiff(
  deltas: readonly GeometryDelta[],
  against = "the reference",
  limit = 12,
): string[] {
  if (!deltas.length) return [];
  const lines = deltas
    .slice(0, limit)
    .map(
      (delta) =>
        `  ${delta.path}  ${delta.property}: ${JSON.stringify(delta.expected)} → ${JSON.stringify(delta.actual)}`,
    );
  if (deltas.length > limit) lines.push(`  … ${deltas.length - limit} more`);
  return [`Geometry and computed styles differ from ${against} (${deltas.length}):`, ...lines];
}
