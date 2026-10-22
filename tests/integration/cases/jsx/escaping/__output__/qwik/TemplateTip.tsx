import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

export default component$<TemplateTipProps & { class?: ClassList; style?: CSSProperties }>(
  ({ example, note, path, class: className, style, ...attributes }) => {
    return (
      <figure class={["template-tip", className]} {...scopeAttributes(attributes)} style={style}>
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
