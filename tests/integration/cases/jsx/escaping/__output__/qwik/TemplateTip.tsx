import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

export default component$<
  TemplateTipProps &
    Omit<PropsOf<"figure">, "example" | "note" | "path" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ example, note, path, class: className, style, ...attributes }) => {
  return (
    <figure class={["template-tip", className]} style={style} {...attributes}>
      <figcaption title={"Vue {{ name }}, Svelte {#if ok}, Angular @if (ok) & JSX {name}"}>
        Template syntax &amp; escaping
      </figcaption>
      <pre>
        <code>{example}</code>
      </pre>
      <p data-sample={"<b> \"double\" 'single' C:\\temp"}>
        {"Static: <b>not bold</b>, {{ name }}, @if (ok) { }"}
      </p>
      <p>{'Literal: {{ name }} <i>not italic</i> {#each items} @for "quoted" C:\\temp café'}</p>
      <p title={'Say "hi" & wave'}>Quoted attribute</p>
      <p title={note} data-path={path}>
        Bound: {note} in {path + "\\index.ts"}
      </p>
      <p>Mustache: {"{{ " + path + " }}"}</p>
      <p>Done &amp;check;</p>
    </figure>
  );
});
