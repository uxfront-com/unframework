import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE_URL = "https://unframework.dev";

// Docus reads the site URL from the environment: for canonical URLs, robots.txt
// and llms.txt at build time, and for the sitemap when it's prerendered.
process.env.NUXT_SITE_URL ||= SITE_URL;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  ssr: true,

  extends: [
    // The homepage kit: components, fonts, head helpers and critical-path loading.
    "@uxfront/layer-ui",
    // The docs theme: Docus, which renders content/docs/ at /docs (see app/app.vue),
    // plus the framework switcher (`docsTheme.frameworks` in app/app.config.ts).
    "@uxfront/layer-docs",
  ],

  runtimeConfig: {
    public: {
      siteUrl: SITE_URL,
    },
  },

  // The docs header and title template (Docus falls back to the package name).
  site: {
    name: "Unframework",
  },

  // Docus's MCP server needs a server at runtime, and the site is static.
  mcp: {
    enabled: false,
  },

  app: {
    head: {
      htmlAttrs: { lang: "en" },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
      link: [
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      ],
    },
  },

  experimental: {
    // Inline the payload on first load (the homepage makes no extra request),
    // and extract it for client-side navigation between docs pages.
    payloadExtraction: "client",
  },

  routeRules: {
    // The docs open on the introduction. /raw/docs.md, the markdown copy of /docs,
    // redirects the same way, since agents may guess it.
    "/docs": { redirect: "/docs/getting-started/introduction" },
    "/raw/docs.md": { redirect: "/raw/docs/getting-started/introduction.md" },
    // Hashed build assets never change, so cache them forever.
    "/_nuxt/**": {
      headers: { "cache-control": "public, max-age=31536000, immutable" },
    },
    "/**": {
      headers: {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Frame-Options": "DENY",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Cross-Origin-Opener-Policy": "same-origin",
      },
    },
  },

  nitro: {
    // Cloudflare compresses at the edge.
    compressPublicAssets: false,
    prerender: {
      crawlLinks: true,
      // /docs only redirects, so crawling the docs starts from the introduction.
      routes: ["/", "/docs", "/docs/getting-started/introduction"],
      failOnError: true,
    },
  },

  $production: {
    nitro: {
      // Emits _headers/_redirects for Cloudflare Pages from routeRules. Build-only:
      // under a Cloudflare preset, `nuxt dev` serves Nuxt Content's browser database
      // from a dump frozen at startup, so after a reload the docs show stale content.
      preset: "cloudflare_pages_static",
    },
  },

  hooks: {
    // Every page would otherwise prefetch the lazy chunks: the docs' (~75 of them),
    // which delay the homepage's fonts and stylesheet, and with them its LCP, and the
    // shaders of the page's own formations, which it imports once the page is idle.
    "build:manifest"(manifest) {
      for (const chunk of Object.values(manifest)) chunk.prefetch = false;
    },
    // Workers rejects the `/* /404.html 404` fallback the preset writes to _redirects
    // (404 isn't a valid redirect status), failing the deploy. not_found_handling in
    // wrangler.jsonc serves 404.html instead. Registered here, not in nitro.hooks,
    // so it runs after the preset's compiled hook instead of replacing it.
    "nitro:init"(nitro) {
      nitro.hooks.hook("compiled", async () => {
        const file = join(nitro.options.output.dir, "_redirects");
        if (!existsSync(file)) return;
        const rules = (await readFile(file, "utf8"))
          .split("\n")
          .filter((line) => line && !/\s404$/.test(line));
        await (rules.length ? writeFile(file, rules.join("\n")) : rm(file));
      });
    },
  },
});
