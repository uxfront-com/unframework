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
  ({ target, failed, lines, warnings, class: className, style }) => {
    return (
      <section class={["build-log", className]} aria-label="Build log" style={style}>
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
