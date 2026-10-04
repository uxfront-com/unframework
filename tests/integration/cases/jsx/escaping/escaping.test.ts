// jsx/escaping: characters that are syntax in some target's template (`<`, `&`, `{{ }}`, `{#if}`,
// `@if`, quotes, backslashes) in interpolated strings, in string-literal children, in static
// text and in static and bound attribute values all render as written. `&check;` is an HTML-only
// reference that JSX leaves as written (UF3011, a warning, so the case still has output).
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import TemplateTip from "./TemplateTip.uf.tsx";

describeTargets("jsx/escaping", () => {
  it("renders template syntax in props as text", async () => {
    const view = await mountScenario(TemplateTip, "template-syntax");
    await view.expectParity("template-syntax");
    await expect
      .element(view.getByText("<b>{{ user.name }}</b> {#if open} @if (open) {} &amp;"))
      .toBeVisible();
    await expect
      .element(view.getByText('Bound: Say "hi" & {{ wave }} in C:\\Users\\ada\\index.ts'))
      .toHaveAttribute("data-path", "C:\\Users\\ada");
    await expect.element(view.getByText("Mustache: {{ C:\\Users\\ada }}")).toBeVisible();
    await expect
      .element(view.getByText("Template syntax & escaping"))
      .toHaveAttribute("title", "Vue {{ name }}, Svelte {#if ok}, Angular @if (ok) & JSX {name}");
  });

  it("renders static text, string literals and the HTML-only reference as written", async () => {
    const view = await mountScenario(TemplateTip, "plain-values");
    await view.expectParity("plain-values");
    await expect.element(view.getByText("const answer = 42;")).toBeVisible();
    await expect
      .element(view.getByText("Static: <b>not bold</b>, {{ name }}, @if (ok) { }"))
      .toHaveAttribute("data-sample", "<b> \"double\" 'single' C:\\temp");
    await expect
      .element(
        view.getByText(
          'Literal: {{ name }} <i>not italic</i> {#each items} @for "quoted" C:\\temp café',
        ),
      )
      .toBeVisible();
    await expect
      .element(view.getByText("Quoted attribute"))
      .toHaveAttribute("title", 'Say "hi" & wave');
    await expect.element(view.getByText("Done &check;")).toBeVisible();
  });
});
