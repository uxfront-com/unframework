// Checks the built site (`dist`) against the search and AI search rules in
// apps/web/README.md, "The SEO check". Run it after a build:
//
//   pnpm --filter web build && pnpm --filter web check:seo
//
// It prints one line per sitemap page and per site-wide file, names the page
// and the rule of every problem, and exits 1 if there is one. It reads files
// only, with no dependencies, so CI runs it in the Build job.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export const SITE_URL = "https://unframework.dev";

export const TITLE_MAX = 60;
export const DESCRIPTION_RANGE: readonly [number, number] = [70, 160];
export const IMAGE_SIZE: readonly [number, number] = [1200, 630];

/** The payload key that carries a docs page's og:image to the client (app/plugins/seo-head.ts). */
export const PAYLOAD_IMAGE = "seo-head:image";

/** The crawlers robots.txt allows by name (plan decision Q1). */
export const AI_CRAWLERS: readonly string[] = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Claude-SearchBot",
  "Claude-User",
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "CCBot",
];

/** The hosts `_headers` keeps out of the index: `www` and every workers.dev host. */
export const NOINDEX_HOSTS: readonly string[] = [
  "https://www.unframework.dev/*",
  "https://:version.:subdomain.workers.dev/*",
];

export interface Problem {
  /** The page's path, or the file a site-wide rule reads. */
  target: string;
  rule: string;
  message: string;
}

export interface Report {
  /** The sitemap's pages, in its order, then the site-wide files. */
  targets: string[];
  problems: Problem[];
}

interface Page {
  path: string;
  title?: string;
  lang?: string;
  h1: number;
  meta: Map<string, string[]>;
  canonical: string[];
  jsonLd: unknown[];
  invalidJsonLd: number;
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export function checkSite(dist: string): Report {
  const problems: Problem[] = [];
  const report = (target: string, rule: string, message: string) =>
    problems.push({ target, rule, message });

  const sitemap = readSitemap(dist, report);
  const headers = readRules(dist, "_headers");
  const redirects = readText(dist, "_redirects") ?? "";
  const redirected = new Set(
    redirects
      .split("\n")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((source): source is string => Boolean(source) && !source!.startsWith("#")),
  );

  // Every page in dist, read once.
  const pages = new Map<string, Page>();
  for (const file of htmlFiles(dist)) {
    const path = pagePath(relative(dist, file));
    pages.set(path, readPage(path, readFileSync(file, "utf8")));
  }

  const urls = new Set(sitemap.map((entry) => entry.loc));
  const lastmods = new Map(sitemap.map((entry) => [entry.loc, entry.lastmod]));

  // Tags on every sitemap page.
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();
  for (const { loc } of sitemap) {
    const path = loc.startsWith(SITE_URL) ? loc.slice(SITE_URL.length) || "/" : loc;
    const page = pages.get(path);
    if (!page) {
      report(path, "sitemap", `${loc} has no HTML file in dist`);
      continue;
    }
    checkPage(page, loc, dist, report);
    if (page.title) {
      titles.set(page.title, [...(titles.get(page.title) ?? []), path]);
    }
    const description = first(page, "description");
    if (description) {
      descriptions.set(description, [...(descriptions.get(description) ?? []), path]);
    }
    checkJsonLd(page, { urls, lastmod: lastmods.get(loc), image: first(page, "og:image") }, report);
    checkPayload(page, loc, dist, report);
  }
  for (const [title, paths] of titles) {
    if (paths.length > 1) {
      for (const path of paths) {
        report(path, "title", `"${title}" is also the title of ${others(paths, path)}`);
      }
    }
  }
  for (const [, paths] of descriptions) {
    if (paths.length > 1) {
      for (const path of paths) {
        report(path, "description", `the description is also ${others(paths, path)}'s`);
      }
    }
  }

  // The sitemap lists every indexable page, and only those.
  for (const [path, page] of pages) {
    const excluded =
      isNoindex(page) || redirected.has(path) || headerNoindex(headers, path) !== undefined;
    if (!excluded && !urls.has(`${SITE_URL}${path}`)) {
      report(path, "sitemap", "an indexable page is missing from sitemap.xml");
    }
  }
  for (const { loc } of sitemap) {
    const path = loc.slice(SITE_URL.length) || "/";
    const page = pages.get(path);
    if (!page) {
      continue;
    }
    if (redirected.has(path)) {
      report(path, "sitemap", "sitemap.xml lists a page _redirects sends elsewhere");
    }
    const rule = headerNoindex(headers, path);
    if (rule) {
      report(path, "sitemap", `sitemap.xml lists a page _headers keeps out of the index (${rule})`);
    }
  }

  checkRobots(readText(dist, "robots.txt"), report);
  checkLlms(readText(dist, "llms.txt"), readText(dist, "llms-full.txt"), sitemap, report);
  checkRedirects(redirects, report);
  checkHeaders(headers, report);

  return {
    targets: [
      ...sitemap.map((entry) => entry.loc.slice(SITE_URL.length) || "/"),
      "sitemap.xml",
      "robots.txt",
      "llms.txt",
      "llms-full.txt",
      "_redirects",
      "_headers",
    ],
    problems,
  };
}

type Reporter = (target: string, rule: string, message: string) => void;

function checkPage(page: Page, loc: string, dist: string, report: Reporter) {
  const at = (rule: string, message: string) => report(page.path, rule, message);

  if (!page.title) {
    at("title", "no <title>");
  } else if (page.title.length > TITLE_MAX) {
    at("title", `${page.title.length} characters, over ${TITLE_MAX}: "${page.title}"`);
  }

  const description = first(page, "description");
  const [min, max] = DESCRIPTION_RANGE;
  if (!description) {
    at("description", "no meta description");
  } else if (description.length < min || description.length > max) {
    at("description", `${description.length} characters, needs ${min} to ${max}`);
  }

  if (page.h1 !== 1) {
    at("h1", `${page.h1} <h1> elements, needs exactly 1`);
  }
  if (!page.lang) {
    at("lang", "no lang on <html>");
  }

  if (page.canonical.length !== 1) {
    at("canonical", `${page.canonical.length} canonical links, needs 1`);
  } else if (page.canonical[0] !== loc) {
    at("canonical", `${page.canonical[0]} isn't the sitemap's URL, ${loc}`);
  }

  for (const key of ["og:title", "og:description", "og:url", "og:type", "og:image"]) {
    if (!first(page, key)) {
      at("open-graph", `no ${key}`);
    }
  }
  const ogUrl = first(page, "og:url");
  if (ogUrl && ogUrl !== loc) {
    at("open-graph", `og:url ${ogUrl} isn't the canonical URL, ${loc}`);
  }

  const [width, height] = IMAGE_SIZE;
  if (first(page, "og:image:width") !== String(width)) {
    at(
      "open-graph",
      `og:image:width is ${first(page, "og:image:width") ?? "missing"}, needs ${width}`,
    );
  }
  if (first(page, "og:image:height") !== String(height)) {
    at(
      "open-graph",
      `og:image:height is ${first(page, "og:image:height") ?? "missing"}, needs ${height}`,
    );
  }
  const image = first(page, "og:image");
  if (image) {
    const size = imageSize(dist, image);
    if (typeof size === "string") {
      at("open-graph", size);
    } else if (size.width !== width || size.height !== height) {
      at(
        "open-graph",
        `the image is ${size.width} × ${size.height}, needs ${width} × ${height}: ${image}`,
      );
    }
  }

  for (const key of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
    if (!first(page, key)) {
      at("twitter", `no ${key}`);
    }
  }

  if (isNoindex(page)) {
    at("robots", "the page has noindex");
  }
}

function checkJsonLd(
  page: Page,
  { urls, lastmod, image }: { urls: Set<string>; lastmod?: string; image?: string },
  report: Reporter,
) {
  const at = (message: string) => report(page.path, "json-ld", message);
  if (page.invalidJsonLd) {
    at(`${page.invalidJsonLd} JSON-LD block(s) don't parse`);
  }

  const nodes = page.jsonLd.flatMap((block) => {
    const graph = (block as { "@graph"?: unknown })["@graph"];
    return Array.isArray(graph) ? graph : [block];
  }) as Record<string, unknown>[];
  const ofType = (type: string) => nodes.filter((node) => node["@type"] === type);

  for (const node of ofType("Organization")) {
    if (node.name === "Unframework") {
      at("an Organization calls Unframework an organisation");
    }
  }

  if (page.path === "/") {
    for (const type of ["WebSite", "SoftwareSourceCode", "Organization"]) {
      if (!ofType(type).length) {
        at(`no ${type}`);
      }
    }
    return;
  }
  if (!page.path.startsWith("/docs/")) {
    return;
  }

  const [article] = ofType("TechArticle");
  if (!article) {
    at("no TechArticle");
  } else {
    if (lastmod && article.dateModified !== lastmod) {
      at(
        `TechArticle's dateModified ${String(article.dateModified)} isn't the sitemap's ${lastmod}`,
      );
    }
    if (image && article.image !== image) {
      at(`TechArticle's image isn't the og:image, ${image}`);
    }
  }
  const [breadcrumbs] = ofType("BreadcrumbList");
  if (!breadcrumbs) {
    at("no BreadcrumbList");
  } else {
    const items = Array.isArray(breadcrumbs.itemListElement) ? breadcrumbs.itemListElement : [];
    for (const { item } of items as { item?: string }[]) {
      if (!item || !urls.has(item)) {
        at(`a breadcrumb links ${item ?? "nothing"}, which isn't in the sitemap`);
      }
    }
  }
}

/**
 * A docs page's `_payload.json` carries its og:image, which the client gives the
 * TechArticle after a client-side navigation, since nuxt-og-image doesn't set
 * og:image again on the client.
 */
function checkPayload(page: Page, loc: string, dist: string, report: Reporter) {
  const image = first(page, "og:image");
  if (!page.path.startsWith("/docs/") || !image) {
    return;
  }
  const text = readText(dist, join(page.path, "_payload.json"));
  if (text === undefined) {
    return report(page.path, "payload", "no _payload.json");
  }
  const entry = payloadImage(text);
  if (entry?.url !== loc || entry.image !== image) {
    report(
      page.path,
      "payload",
      "_payload.json doesn't carry the og:image, so the TechArticle loses it after a client-side navigation",
    );
  }
}

/**
 * The `{ url, image }` under `data[PAYLOAD_IMAGE]` in a payload, which devalue
 * flattens into one array whose values point at each other by index.
 */
function payloadImage(text: string): { url?: unknown; image?: unknown } | undefined {
  let values: unknown;
  try {
    values = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!Array.isArray(values)) {
    return undefined;
  }
  const at = (index: unknown): unknown => {
    let value: unknown = typeof index === "number" ? values[index] : undefined;
    // A reducer wraps a value as its name and its index, like `["ShallowReactive", 2]`.
    for (let depth = 0; depth < 8 && isReduced(value); depth++) {
      value = values[value[1]];
    }
    return value;
  };
  const field = (value: unknown, key: string) =>
    value && typeof value === "object" && key in value
      ? at((value as Record<string, unknown>)[key])
      : undefined;
  const entry = field(field(at(0), "data"), PAYLOAD_IMAGE);
  return entry === undefined
    ? undefined
    : { url: field(entry, "url"), image: field(entry, "image") };
}

const isReduced = (value: unknown): value is [string, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "string" &&
  typeof value[1] === "number";

function readSitemap(dist: string, report: Reporter): SitemapEntry[] {
  const xml = readText(dist, "sitemap.xml");
  if (xml === undefined) {
    report("sitemap.xml", "sitemap", "no sitemap.xml");
    return [];
  }
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body = ""]) => ({
    loc: decodeEntities(body.match(/<loc>([\s\S]*?)<\/loc>/)?.[1]?.trim() ?? ""),
    lastmod: body.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1]?.trim(),
  }));
  if (!entries.length) {
    report("sitemap.xml", "sitemap", "no <url> entries");
  }
  const seen = new Set<string>();
  for (const { loc, lastmod } of entries) {
    if (!loc.startsWith(`${SITE_URL}/`)) {
      report("sitemap.xml", "sitemap", `${loc} isn't on ${SITE_URL}`);
    }
    if (seen.has(loc)) {
      report("sitemap.xml", "sitemap", `${loc} is listed twice`);
    }
    seen.add(loc);
    if (!lastmod) {
      report("sitemap.xml", "lastmod", `${loc} has no <lastmod>`);
    } else if (!isDate(lastmod)) {
      report("sitemap.xml", "lastmod", `${loc} has an invalid <lastmod>, ${lastmod}`);
    }
  }
  return entries;
}

function checkRobots(robots: string | undefined, report: Reporter) {
  const at = (message: string) => report("robots.txt", "robots", message);
  if (robots === undefined) {
    return at("no robots.txt");
  }
  const lines = robots.split("\n").map((line) => line.replace(/#.*/, "").trim());
  if (!lines.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) {
    at(`no "Sitemap: ${SITE_URL}/sitemap.xml" line`);
  }

  // A group is a run of User-agent lines and the rules after them.
  const groups: { agents: string[]; rules: string[] }[] = [];
  let current: { agents: string[]; rules: string[] } | undefined;
  for (const line of lines) {
    const [, field = "", value = ""] = line.match(/^([^:]+):\s*(.*)$/) ?? [];
    const name = field.toLowerCase();
    if (name === "user-agent") {
      if (!current || current.rules.length) {
        groups.push((current = { agents: [], rules: [] }));
      }
      current.agents.push(value);
    } else if (current && (name === "allow" || name === "disallow")) {
      current.rules.push(`${name}:${value}`);
    }
  }
  for (const crawler of AI_CRAWLERS) {
    const group = groups.find(({ agents }) => agents.includes(crawler));
    if (!group) {
      at(`no group for ${crawler}`);
    } else if (!group.rules.includes("allow:/") || group.rules.includes("disallow:/")) {
      at(`${crawler}'s group doesn't allow /`);
    }
  }
}

function checkLlms(
  llms: string | undefined,
  full: string | undefined,
  sitemap: SitemapEntry[],
  report: Reporter,
) {
  if (llms === undefined) {
    report("llms.txt", "llms", "no llms.txt");
  } else {
    const lines = llms.split("\n").filter((line) => line.trim());
    if (!lines[0]?.startsWith("# ")) {
      report("llms.txt", "llms", "doesn't start with an H1");
    }
    if (!lines[1]?.startsWith("> ")) {
      report("llms.txt", "llms", "no > summary under the H1");
    }
    for (const { loc } of sitemap) {
      const path = loc.slice(SITE_URL.length);
      if (!path.startsWith("/docs/")) {
        continue;
      }
      const raw = `${SITE_URL}/raw${path}.md`;
      if (!llms.includes(`(${raw})`)) {
        report("llms.txt", "llms", `no link to ${raw}`);
      }
    }
  }
  if (full === undefined) {
    report("llms-full.txt", "llms", "no llms-full.txt");
  } else {
    const residue = full.split("&#x22;").length - 1;
    if (residue) {
      report("llms-full.txt", "llms", `${residue} copies of MDC attribute residue (&#x22;)`);
    }
    const tables = full.match(/^\s*<(?:table|thead|tbody|tr)\b/gim)?.length ?? 0;
    if (tables) {
      report("llms-full.txt", "llms", `${tables} lines of HTML tables`);
    }
  }
}

function checkRedirects(redirects: string, report: Reporter) {
  for (const line of redirects.split("\n")) {
    const [source, destination, status = "302"] = line.trim().split(/\s+/);
    if (!source || source.startsWith("#") || !destination) {
      continue;
    }
    // Cloudflare redirects with a 302 when a rule names no status.
    if (status === "302" || status === "307") {
      report("_redirects", "redirects", `${source} redirects with a temporary ${status}`);
    }
  }
}

function checkHeaders(headers: HeaderRule[], report: Reporter) {
  for (const host of NOINDEX_HOSTS) {
    const rule = headers.find(({ pattern }) => pattern === host);
    if (!rule || !rule.headers.some(isNoindexHeader)) {
      report("_headers", "headers", `no ${host} rule with X-Robots-Tag: noindex`);
    }
  }
}

export interface HeaderRule {
  pattern: string;
  headers: string[];
}

function readRules(dist: string, file: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const line of (readText(dist, file) ?? "").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }
    if (/^\s/.test(line)) {
      rules.at(-1)?.headers.push(line.trim());
    } else {
      rules.push({ pattern: line.trim(), headers: [] });
    }
  }
  return rules;
}

const isNoindexHeader = (header: string) => /^x-robots-tag:.*\bnoindex\b/i.test(header);

/**
 * The host-less `_headers` rule that sends `noindex` for a path, if any. Host
 * rules don't count: they end in `/*` and would match every path.
 */
export function headerNoindex(headers: HeaderRule[], path: string): string | undefined {
  return headers.find(
    ({ pattern, headers }) =>
      pattern.startsWith("/") && headers.some(isNoindexHeader) && matchesPath(pattern, path),
  )?.pattern;
}

/** Cloudflare's `_headers` path matching: one `*` splat, and `:name` for a segment. */
function matchesPath(pattern: string, path: string) {
  const source = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => (part === "*" ? ".*" : part.startsWith(":") ? "[^/]+" : escapeRegExp(part)))
    .join("");
  return new RegExp(`^${source}$`).test(path);
}

// A tag's attributes, where a quoted value may hold a `>`, as in `content="<component is>"`.
const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;

function readPage(path: string, html: string): Page {
  const head = html.slice(0, Math.max(0, html.indexOf("</head>"))) || html;
  const meta = new Map<string, string[]>();
  const canonical: string[] = [];
  for (const [, tag = "", attrs = ""] of head.matchAll(
    new RegExp(`<(meta|link)\\b(${ATTRS})>`, "gi"),
  )) {
    const props = attributes(attrs);
    if (tag.toLowerCase() === "meta") {
      const key = props.get("property") ?? props.get("name");
      const content = props.get("content");
      if (key && content !== undefined) {
        meta.set(key, [...(meta.get(key) ?? []), content]);
      }
    } else if (props.get("rel") === "canonical" && props.has("href")) {
      canonical.push(props.get("href")!);
    }
  }

  const jsonLd: unknown[] = [];
  let invalidJsonLd = 0;
  for (const [, attrs = "", body = ""] of html.matchAll(
    new RegExp(`<script\\b(${ATTRS})>([\\s\\S]*?)</script>`, "gi"),
  )) {
    if (attributes(attrs).get("type") !== "application/ld+json") {
      continue;
    }
    try {
      jsonLd.push(JSON.parse(body));
    } catch {
      invalidJsonLd += 1;
    }
  }

  // Count only rendered headings: scripts (the payload), styles and comments can quote markup.
  const body = html.replace(/<(script|style|template)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, "");
  const title = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    path,
    title: title === undefined ? undefined : decodeEntities(title.trim()),
    lang:
      attributes(html.match(new RegExp(`<html\\b(${ATTRS})>`, "i"))?.[1] ?? "").get("lang") ||
      undefined,
    h1: body.match(/<h1[\s>]/gi)?.length ?? 0,
    meta,
    canonical,
    jsonLd,
    invalidJsonLd,
  };
}

function attributes(source: string) {
  const props = new Map<string, string>();
  for (const [, name = "", double, single, bare] of source.matchAll(
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
  )) {
    props.set(name.toLowerCase(), decodeEntities(double ?? single ?? bare ?? ""));
  }
  return props;
}

const first = (page: Page, key: string) => page.meta.get(key)?.[0];

const isNoindex = (page: Page) =>
  (page.meta.get("robots") ?? []).some((content) => /\bnoindex\b/i.test(content));

/** The image's width and height from its header, or the problem reading it. */
function imageSize(dist: string, url: string): { width: number; height: number } | string {
  if (!url.startsWith(`${SITE_URL}/`)) {
    return `og:image isn't on ${SITE_URL}: ${url}`;
  }
  const path = url.slice(SITE_URL.length).split(/[?#]/)[0]!;
  const file = [join(dist, path), join(dist, safeDecode(path))].find((candidate) =>
    existsSync(candidate),
  );
  if (!file) {
    return `og:image isn't in dist: ${url}`;
  }
  const bytes = readFileSync(file);
  // PNG: the IHDR chunk's width and height.
  if (bytes.subarray(1, 4).toString("latin1") === "PNG") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  // JPEG: the first start-of-frame segment.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff) {
        break;
      }
      const marker = bytes[offset + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
  }
  return `og:image is neither a PNG nor a JPEG with a size in its header: ${url}`;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((file) => join(dir, file))
    .filter((file) => file.endsWith(".html") && statSync(file).isFile())
    .sort();
}

/** The URL path a file serves at: `docs/a.html` and `docs/a/index.html` at `/docs/a`. */
export function pagePath(file: string): string {
  const path = `/${file.split(sep).join("/")}`.replace(/(?:\/index)?\.html$/, "");
  return path || "/";
}

function readText(dist: string, file: string) {
  const path = join(dist, file);
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const others = (paths: string[], path: string) =>
  paths.filter((other) => other !== path).join(", ");

function decodeEntities(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (code[0] !== "#") {
      return named[code.toLowerCase()] ?? entity;
    }
    const point =
      code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return String.fromCodePoint(point);
  });
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prints the report: one line per target, its problems under it, then a summary. */
export function format({ targets, problems }: Report): string {
  const lines: string[] = [];
  for (const target of targets) {
    const own = problems.filter((problem) => problem.target === target);
    lines.push(`${own.length ? "✗" : "✓"} ${target}`);
    for (const { rule, message } of own) {
      lines.push(`    ${target}: ${rule}: ${message}`);
    }
  }
  // Pages outside the sitemap, like one missing from it.
  for (const problem of problems.filter(({ target }) => !targets.includes(target))) {
    lines.push(`✗ ${problem.target}`, `    ${problem.target}: ${problem.rule}: ${problem.message}`);
  }
  const pages = targets.filter((target) => target.startsWith("/")).length;
  lines.push(
    "",
    `${pages} pages and ${targets.length - pages} files checked, ${problems.length} ${problems.length === 1 ? "problem" : "problems"}`,
  );
  return lines.join("\n");
}

if (import.meta.main) {
  const dist = resolve(process.argv[2] ?? "dist");
  if (!existsSync(join(dist, "index.html"))) {
    console.error(`No build in ${dist}: run \`pnpm --filter web build\` first.`);
    process.exit(2);
  }
  const report = checkSite(dist);
  process.stdout.write(`${format(report)}\n`);
  process.exitCode = report.problems.length ? 1 : 0;
}
