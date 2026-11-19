// The Vue Vapor server renderer (Node, inside the `ssr:vue-vapor` project, ADR-0112): Vue 3.6's
// server renderer. Vue compiles a Vapor component for the server to the same `ssrRender` as any
// other, so the server renders it as Vue's own adapter does; only Vue's version is checked here.
import type { HydrationRenderer, SsrRenderer } from "@unframework.dev/codegen";
import { createSSRApp } from "vue";
import type { Component } from "vue";
import { renderToString as renderApp } from "vue/server-renderer";

import { vaporApi } from "./guard.ts";

vaporApi();

/**
 * Renders a compiled Vapor component on the server: a fresh SSR app per render, with the props as
 * root props. Vue's output is the component's HTML alone, with no container to strip.
 */
export const renderToString: SsrRenderer = async (component, { props }) => {
  const app = createSSRApp(component as Component, props ? { ...props } : null);
  return renderApp(app);
};

/**
 * Renders the server HTML the hydrate adapter hydrates (L12, ADR-0095), with the props as root
 * props, as the adapter's Vapor root takes them, so the component tree, and the ids `useId`
 * derives from it, are the same on both sides.
 */
export const renderForHydration: HydrationRenderer = (component, options) =>
  renderToString(component, options);
