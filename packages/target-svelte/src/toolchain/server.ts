import type { HydrationRenderer, SsrRenderer } from "@unframework.dev/codegen";
import type { Component } from "svelte";
import { render } from "svelte/server";

/**
 * Renders a compiled Svelte component on the server. Only `body` is the component's HTML:
 * `head` holds what it puts in `<svelte:head>`, which belongs to the document.
 */
export const renderToString: SsrRenderer = async (component, { props }) => {
  const { body } = await render(component as Component<Record<string, unknown>>, {
    props: { ...props },
  });
  return body;
};

/**
 * Renders the server HTML the hydrate adapter hydrates (L12, ADR-0095): the body, with the
 * hydration markers Svelte writes (`<!--[-->`, `<!--$s1-->`), which `hydrate` reads.
 */
export const renderForHydration: HydrationRenderer = renderToString;
