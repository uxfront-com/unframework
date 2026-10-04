import { component$ } from "@qwik.dev/core";

export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

export default component$<TemplateTipProps>(({ example, note, path }) => {
  return (
    <figure class="template-tip">
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
