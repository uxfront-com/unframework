import type { SsrRenderer } from "@unframework/codegen";
import { createSSRApp } from "vue";
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
