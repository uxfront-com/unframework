// The run's page (plan §8.6, ADR-0087): `<out>/report.html`, beside `report.json`, a seven-up grid
// for each example, and for each failed cell a diff overlay and its geometry deltas. It opens from
// `file://` with no server and no network request: the styles are inline, the overlay switches
// with native radio buttons and CSS alone, so the page carries no script, and every image is a
// relative path the report names. An image the report doesn't name is never linked, so a cell
// that left no `reference.png` or `diff.png` says so instead of showing a broken image.
import type { GeometryDelta } from "@unframework.dev/testing/node";

import type { VisualCell, VisualExample, VisualImages, VisualReport } from "./report.ts";

/** The most geometry deltas a cell's table lists: the page names the total when it holds more. */
export const MAX_DELTA_ROWS = 100;

/** The views of a failed cell's overlay, in the order its switch offers them. */
const VIEWS = [
  { key: "reference", label: "Reference", file: "reference.png" },
  { key: "actual", label: "Actual", file: "actual.png" },
  { key: "diff", label: "Diff", file: "diff.png" },
] as const satisfies readonly { key: keyof VisualImages; label: string; file: string }[];

/** The HTML page of a run's report: a whole document, self-contained but for its images. */
export function renderReport(report: VisualReport): string {
  const cells = report.examples.flatMap((example) => example.cells);
  const failed = cells.filter((cell) => cell.status === "failed").length;
  const title = `Visual report: ${report.passed ? "passed" : "failed"}`;
  const summary = cells.length
    ? report.passed
      ? `Every cell passed: ${count(report.examples.length, "example")} on ${count(report.targets.length, "target")}.`
      : `${failed} of ${count(cells.length, "cell")} failed, across ${count(report.examples.length, "example")} on ${count(report.targets.length, "target")}.`
    : "This run has no examples.";
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLES}</style>`,
    "</head>",
    "<body>",
    "<header>",
    `<h1>Visual report <span class="status" data-status="${report.passed ? "passed" : "failed"}">${statusText(report.passed ? "passed" : "failed")}</span></h1>`,
    `<p class="summary">${escapeHtml(summary)}</p>`,
    '<dl class="facts">',
    fact("Pixels", report.pixels === "live" ? "Live, against the reference" : "Baseline files"),
    fact("Reference", report.reference),
    fact("Targets", report.targets.join(", ") || "None"),
    report.update ? fact("Baselines", "Written by this run") : "",
    "</dl>",
    "</header>",
    "<main>",
    ...report.examples.map((example, index) => renderExample(example, index)),
    "</main>",
    "</body>",
    "</html>",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderExample(example: VisualExample, index: number): string {
  const heading = `example-${index}`;
  const failed = example.cells.filter((cell) => cell.status === "failed");
  return [
    `<section class="example" aria-labelledby="${heading}">`,
    `<h2 id="${heading}">${escapeHtml(example.id)}</h2>`,
    `<p class="file"><code>${escapeHtml(example.file)}</code></p>`,
    `<ul class="grid" aria-label="${escapeHtml(`${example.id} on each target`)}">`,
    ...example.cells.map((cell) => renderCell(example, index, cell)),
    "</ul>",
    ...failed.map((cell) => renderFailure(example, index, cell)),
    "</section>",
  ].join("\n");
}

function renderCell(example: VisualExample, index: number, cell: VisualCell): string {
  const image = cell.images.capture ?? cell.images.actual;
  const alt = `${example.id} on ${cell.target}`;
  const frame = image
    ? `<a class="frame" href="${url(image)}"><img src="${url(image)}" alt="${escapeHtml(alt)}"></a>`
    : `<div class="frame empty"><span>No capture</span></div>`;
  const detail =
    cell.status === "failed"
      ? `<a class="more" href="#${failureId(index, cell)}">Details<span class="visually-hidden"> for ${escapeHtml(cell.target)}</span></a>`
      : "";
  return [
    `<li class="cell" data-status="${cell.status}" data-target="${escapeHtml(cell.target)}">`,
    frame,
    '<p class="label">',
    `<span class="target">${escapeHtml(cell.target)}</span>`,
    cell.role === "reference" ? '<span class="role">reference</span>' : "",
    `<span class="status" data-status="${cell.status}">${statusText(cell.status)}</span>`,
    "</p>",
    `<p class="outcome"><code>${escapeHtml(cell.outcome)}</code>${cell.diffPixels ? ` <span>${escapeHtml(`${count(cell.diffPixels, "pixel")} ${cell.diffPixels === 1 ? "differs" : "differ"}`)}</span>` : ""}</p>`,
    detail,
    "</li>",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderFailure(example: VisualExample, index: number, cell: VisualCell): string {
  const id = failureId(index, cell);
  const views = VIEWS.filter((view) => cell.images[view.key] !== undefined);
  return [
    `<section class="failure" id="${id}" aria-labelledby="${id}-heading">`,
    `<h3 id="${id}-heading">${escapeHtml(`${example.id} on ${cell.target}`)}: <code>${escapeHtml(cell.outcome)}</code></h3>`,
    cell.message ? `<pre class="message">${escapeHtml(cell.message)}</pre>` : "",
    views.length ? renderOverlay(example, id, cell, views) : "",
    renderAbsent(cell),
    cell.images.geometry
      ? `<p><a href="${url(cell.images.geometry)}">Open <code>geometry.actual.json</code></a></p>`
      : "",
    renderDeltas(id, cell.geometry),
    "</section>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The diff overlay: one radio button for each image the cell left, all stacked in one frame, and
 * only the checked one visible. Arrow keys move between them, as in any radio group, and the
 * frame keeps the size of its largest image, so switching never moves the page.
 */
function renderOverlay(
  example: VisualExample,
  id: string,
  cell: VisualCell,
  views: readonly (typeof VIEWS)[number][],
): string {
  const initial = views.at(-1)!.key;
  return [
    '<div class="overlay">',
    '<fieldset class="switch">',
    "<legend>Show</legend>",
    ...views.map(
      (view) =>
        `<label><input type="radio" name="${id}-view" value="${view.key}"${view.key === initial ? " checked" : ""}>${view.label}</label>`,
    ),
    "</fieldset>",
    '<div class="stack">',
    ...views.map(
      (view) =>
        `<img data-view="${view.key}" src="${url(cell.images[view.key]!)}" alt="${escapeHtml(`${view.label}: ${example.id} on ${cell.target}`)}">`,
    ),
    "</div>",
    "</div>",
  ].join("\n");
}

/**
 * What a failed cell didn't leave, so the page says so rather than show a broken image: the files
 * of a comparison that stopped part way, or that there was no comparison to leave any.
 */
function renderAbsent(cell: VisualCell): string {
  const files = [
    ...VIEWS.map((view) => ({ name: view.file, present: cell.images[view.key] !== undefined })),
    { name: "geometry.actual.json", present: cell.images.geometry !== undefined },
  ];
  const absent = files.filter((file) => !file.present).map((file) => `<code>${file.name}</code>`);
  if (absent.length < files.length) {
    return absent.length ? `<p class="absent">The run left no ${list(absent)}.</p>` : "";
  }
  return cell.images.capture
    ? '<p class="absent">The run left only the capture in the grid, and no comparison files.</p>'
    : '<p class="absent">The run left no image for this cell.</p>';
}

function renderDeltas(id: string, deltas: readonly GeometryDelta[]): string {
  if (!deltas.length) return '<p class="no-deltas">No geometry or computed-style delta.</p>';
  const shown = deltas.slice(0, MAX_DELTA_ROWS);
  const caption =
    shown.length < deltas.length
      ? `Geometry deltas: the first ${shown.length} of ${deltas.length}`
      : `Geometry deltas: ${deltas.length}`;
  return [
    `<div class="deltas" role="region" tabindex="0" aria-labelledby="${id}-deltas">`,
    "<table>",
    `<caption id="${id}-deltas">${escapeHtml(caption)}</caption>`,
    '<thead><tr><th scope="col">Node</th><th scope="col">Property</th><th scope="col">Expected</th><th scope="col">Actual</th></tr></thead>',
    "<tbody>",
    ...shown.map(
      (delta) =>
        `<tr><td><code>${escapeHtml(delta.path)}</code></td><td><code>${escapeHtml(delta.property)}</code></td><td>${value(delta.expected)}</td><td>${value(delta.actual)}</td></tr>`,
    ),
    "</tbody>",
    "</table>",
    "</div>",
  ].join("\n");
}

function fact(term: string, detail: string): string {
  return `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(detail)}</dd></div>`;
}

/** The status in words, after a mark that only repeats them. */
function statusText(status: "passed" | "failed"): string {
  return `<span aria-hidden="true">${status === "passed" ? "✓" : "✗"}</span> ${status === "passed" ? "Passed" : "Failed"}`;
}

/** A delta's value: a string as it is, anything else as JSON, and an absent one as such. */
function value(item: unknown): string {
  if (item === undefined || item === null) return '<span class="none">none</span>';
  return `<code>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</code>`;
}

/** The id of a failed cell's section: an example's index and a target name, safe in a fragment. */
function failureId(index: number, cell: VisualCell): string {
  return `example-${index}-${cell.target.replaceAll(/[^A-Za-z0-9_-]/g, "_")}`;
}

/**
 * A relative path as a URL: each segment encoded, so a name with `#` or `?` stays a file, and a
 * path can never become another scheme's URL.
 */
function url(path: string): string {
  return escapeHtml(path.split("/").map(encodeURIComponent).join("/"));
}

function count(n: number, noun: string): string {
  return `${NUMBER.format(n)} ${noun}${n === 1 ? "" : "s"}`;
}

/** Thousands separated, in one locale, so the page is the same on every machine (P8). */
const NUMBER = new Intl.NumberFormat("en");

/** `a`, `a or b`, `a, b or c`. */
function list(items: readonly string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * The page's styles: the system's fonts and colour scheme, a grid that fits seven cells across a
 * desktop window and wraps on a phone, and frames of a fixed shape, so nothing moves as the
 * images load.
 */
const STYLES = `
:root {
  color-scheme: light dark;
  --bg: light-dark(#ffffff, #141414);
  --fg: light-dark(#1a1a1a, #ececec);
  --muted: light-dark(#555555, #b4b4b4);
  --line: light-dark(#d6d6d6, #3a3a3a);
  --panel: light-dark(#f4f4f4, #1f1f1f);
  --passed: light-dark(#17663a, #7fd99b);
  --failed: light-dark(#b0201a, #ff9b93);
  --focus: light-dark(#0b57d0, #8ab4f8);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--fg);
}
* { box-sizing: border-box; }
body { margin: 0 auto; padding: 1.5rem; max-width: 96rem; }
h1, h2, h3 { line-height: 1.25; overflow-wrap: anywhere; }
h1 { font-size: 1.6rem; margin: 0 0 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: baseline; }
h2 { font-size: 1.25rem; margin: 0; }
h3 { font-size: 1.05rem; margin: 0 0 0.75rem; }
code, pre { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.875em; }
a { color: var(--focus); }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.summary { margin: 0 0 0.75rem; }
.facts { display: flex; flex-wrap: wrap; gap: 0.25rem 1.5rem; margin: 0 0 2rem; color: var(--muted); }
.facts div { display: flex; gap: 0.4rem; }
.facts dt { font-weight: 600; }
.facts dd { margin: 0; overflow-wrap: anywhere; }
.status { font-size: 0.875rem; font-weight: 600; white-space: nowrap; }
.status[data-status="passed"] { color: var(--passed); }
.status[data-status="failed"] { color: var(--failed); }
.example { border-top: 1px solid var(--line); padding: 1.5rem 0; }
.file { margin: 0.25rem 0 1rem; color: var(--muted); overflow-wrap: anywhere; }
.grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr)); }
.cell { border: 1px solid var(--line); border-radius: 6px; padding: 0.5rem; min-width: 0; }
.cell[data-status="failed"] { border-color: var(--failed); border-width: 2px; padding: calc(0.5rem - 1px); }
.frame { display: grid; place-items: center; aspect-ratio: 4 / 3; background: var(--panel); border-radius: 4px; overflow: hidden; }
.frame img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.frame.empty { color: var(--muted); font-size: 0.875rem; }
.label { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.5rem; margin: 0.5rem 0 0; }
.target { font-weight: 600; overflow-wrap: anywhere; }
.role { font-size: 0.8rem; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 0 0.4rem; }
.label .status { margin-left: auto; }
.outcome { margin: 0.25rem 0 0; color: var(--muted); overflow-wrap: anywhere; }
.more { display: inline-block; margin-top: 0.25rem; font-size: 0.875rem; }
.failure { margin-top: 1.5rem; padding: 1rem; background: var(--panel); border-radius: 6px; scroll-margin-top: 1rem; }
.message { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0 0 1rem; max-height: 16rem; overflow: auto; }
.overlay { margin-bottom: 1rem; }
.switch { display: inline-flex; flex-wrap: wrap; gap: 0; border: 0; padding: 0; margin: 0 0 0.75rem; }
.switch legend { float: left; margin-right: 0.75rem; padding: 0.35rem 0; font-weight: 600; }
.switch label { position: relative; padding: 0.35rem 0.9rem; border: 1px solid var(--line); background: var(--bg); cursor: pointer; }
.switch label + label { margin-left: -1px; }
.switch label:first-of-type { border-radius: 6px 0 0 6px; }
.switch label:last-of-type { border-radius: 0 6px 6px 0; }
.switch input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.switch label:has(input:checked) { background: var(--fg); color: var(--bg); border-color: var(--fg); z-index: 1; }
.switch label:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; z-index: 2; }
.stack { display: grid; justify-items: start; max-width: 100%; overflow: auto; background: var(--bg); border: 1px solid var(--line); border-radius: 4px; padding: 0.5rem; }
.stack img { grid-area: 1 / 1; max-width: 100%; height: auto; visibility: hidden; }
.overlay:has(input[value="reference"]:checked) img[data-view="reference"],
.overlay:has(input[value="actual"]:checked) img[data-view="actual"],
.overlay:has(input[value="diff"]:checked) img[data-view="diff"] { visibility: visible; }
.absent { color: var(--muted); }
.deltas { overflow-x: auto; max-width: 100%; }
table { border-collapse: collapse; width: max-content; min-width: 100%; }
caption { text-align: left; font-weight: 600; padding: 0 0 0.5rem; }
th, td { text-align: left; vertical-align: top; padding: 0.35rem 0.75rem 0.35rem 0; border-bottom: 1px solid var(--line); max-width: 24rem; overflow-wrap: anywhere; }
th { font-weight: 600; }
.none, .no-deltas { color: var(--muted); }
@media (min-width: 70rem) {
  .grid { grid-template-columns: repeat(7, minmax(0, 1fr)); }
}
`
  .trim()
  .replaceAll(/\n\s*/g, "\n");
