import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: TemplateTipProps & TemplateTipAttributes) {
  return (
    <figure
      className={cx("template-tip", className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
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
