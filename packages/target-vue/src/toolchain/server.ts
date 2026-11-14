import type { HydrationRenderer, SsrRenderer } from "@unframework.dev/codegen";
import { createSSRApp, h } from "vue";
import type { Component } from "vue";
import { renderToString as renderApp } from "vue/server-renderer";

/**
 * Renders a compiled Vue component on the server: a fresh SSR app per render, with the props as
 * root props. Vue's output is the component's HTML alone, with no container to strip.
 */
export const renderToString: SsrRenderer = async (component, { props }) => {
  const app = createSSRApp(component as Component, props ? { ...props } : null);
  return renderApp(app);
};

/**
 * Renders the server HTML the hydrate adapter hydrates (L12, ADR-0095): the root renders the
 * component, as the adapter's root does, so the component tree, and the ids `useId` derives from
 * it, are the same on both sides.
 */
export const renderForHydration: HydrationRenderer = async (component, { props }) => {
  const app = createSSRApp({ render: () => h(component as Component, { ...props }) });
  return renderApp(app);
};
