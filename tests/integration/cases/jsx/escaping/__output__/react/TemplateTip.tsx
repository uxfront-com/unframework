import type { CSSProperties } from "react";

export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

export interface TemplateTipAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function TemplateTip({
  example,
  note,
  path,
  className,
  style,
}: TemplateTipProps & TemplateTipAttributes) {
  return (
    <figure className={cx("template-tip", className)} style={style}>
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
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
