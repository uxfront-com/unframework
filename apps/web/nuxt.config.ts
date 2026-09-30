import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// The lazy shader chunks of the formations in app/formations/.
const FORMATION_SHADER = /(?:^|[/\\])formations[/\\][^/\\]+[/\\]shader\.[jt]s$/;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  ssr: true,

  // The homepage kit: components, fonts, head helpers and critical-path loading.
  extends: ["@uxfront/layer-ui"],

  runtimeConfig: {
    public: {
      siteUrl: "https://unframework.dev",
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: "en" },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#050507" },
        { name: "color-scheme", content: "dark" },
      ],
      link: [
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      ],
    },
  },

  experimental: {
    // One static page: inline the payload instead of fetching it.
    payloadExtraction: false,
  },

  routeRules: {
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
    // Emits _headers/_redirects for Cloudflare Pages from routeRules.
    preset: "cloudflare_pages_static",
    // Cloudflare compresses at the edge.
    compressPublicAssets: false,
    prerender: {
      crawlLinks: true,
      routes: ["/"],
      failOnError: true,
    },
  },

  hooks: {
    // The page's own formations import their shaders once the page is idle, like
    // @uxfront/scene's (which @uxfront/layer-ui already keeps out of prefetch).
    // A prefetch hint would pull them into the critical path instead.
    "build:manifest"(manifest) {
      for (const chunk of Object.values(manifest)) {
        chunk.dynamicImports = chunk.dynamicImports?.filter((key) => !FORMATION_SHADER.test(key));
      }
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
