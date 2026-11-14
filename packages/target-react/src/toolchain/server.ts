// The React SSR renderer (Node, inside the `ssr:react` project).
import type { HydrationRenderer, SsrRenderer } from "@unframework.dev/codegen";
import { createElement } from "react";
import { prerender } from "react-dom/static";

import { asComponent } from "./component.ts";

/** React's document: the component is the whole `<body>`. */
const DOCUMENT = /^<!DOCTYPE html><html><head>[\s\S]*?<\/head><body>([\s\S]*)<\/body><\/html>$/;

/**
 * Renders with `prerender`, which waits for all data like static generation does. The
 * component is rendered inside an `<html>` shell because React 19 hoists resources (a
 * `<link rel="preload">` for every `<img>`, titles, metas) into `<head>`, and without one it
 * prepends them to the component's HTML. The result is the content of `<body>`.
 */
export const renderToString: SsrRenderer = async (component, options) => {
  const errors: unknown[] = [];
  const tree = createElement(
    "html",
    null,
    createElement("head"),
    createElement("body", null, createElement(asComponent(component), { ...options.props })),
  );
  // Errors React recovers from (a boundary renders on the client instead) still fail the render.
  const { prelude } = await prerender(tree, { onError: (error) => void errors.push(error) });
  if (errors.length > 0) {
    throw errors.length === 1 ? errors[0] : new AggregateError(errors, "React SSR failed.");
  }
  const document = await new Response(prelude).text();
  const body = DOCUMENT.exec(document);
  if (!body) throw new Error(`React's prerender produced an unexpected document:\n${document}`);
  return body[1] ?? "";
};

/**
 * Renders the server HTML the hydrate adapter hydrates (L12, ADR-0095): the component alone, as
 * the root of the tree. `hydrateRoot` hydrates it as the root of a container, so the tree has the
 * same shape on both sides, and `useId` gives the same ids: inside `renderToString`'s `<html>`
 * shell the component sits after `<head>`, a fork that changes every id it generates. What React
 * hoists (a `<link rel="preload">` for an `<img>`) then comes first.
 */
export const renderForHydration: HydrationRenderer = async (component, options) => {
  const errors: unknown[] = [];
  const { prelude } = await prerender(createElement(asComponent(component), { ...options.props }), {
    onError: (error) => void errors.push(error),
  });
  if (errors.length > 0) {
    throw errors.length === 1 ? errors[0] : new AggregateError(errors, "React SSR failed.");
  }
  return new Response(prelude).text();
};
