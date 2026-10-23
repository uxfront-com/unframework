import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

interface LogLine {
  id: string;
  text: string;
}

export interface BuildLogProps {
  target: string;
  failed: boolean;
  lines?: LogLine[] | null;
  warnings?: string[];
}

export default component$<BuildLogProps & { class?: ClassList; style?: CSSProperties }>(
  ({ target, failed, lines, warnings, class: className, style, ...attributes }) => {
    return (
      <section
        class={["build-log", className]}
        aria-label="Build log"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <pre>
          $ make {target}
          <>{failed ? <strong> (failed)</strong> : null}</>
          {"\n"}
          {(lines ?? []).map((line) => (
            <code key={line.id}>
              {line.text}
              {"\n"}
            </code>
          ))}
        </pre>
        <ul aria-label="Warnings">
          {(warnings ?? []).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>
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
