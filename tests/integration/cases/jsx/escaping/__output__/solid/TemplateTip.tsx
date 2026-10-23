import type { JSX } from "solid-js";

export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

export default function TemplateTip(
  props: TemplateTipProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <figure
      class={props.class ? `template-tip ${props.class}` : "template-tip"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <figcaption title={"Vue {{ name }}, Svelte {#if ok}, Angular @if (ok) & JSX {name}"}>
        Template syntax &amp; escaping
      </figcaption>
      <pre>
        <code>{props.example}</code>
      </pre>
      <p data-sample={"<b> \"double\" 'single' C:\\temp"}>
        {"Static: <b>not bold</b>, {{ name }}, @if (ok) { }"}
      </p>
      <p>{'Literal: {{ name }} <i>not italic</i> {#each items} @for "quoted" C:\\temp café'}</p>
      <p title={'Say "hi" & wave'}>Quoted attribute</p>
      <p title={props.note} data-path={props.path}>
        Bound: {props.note} in {props.path + "\\index.ts"}
      </p>
      <p>Mustache: {"{{ " + props.path + " }}"}</p>
      <p>Done &amp;check;</p>
    </figure>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
