import { component$ } from "@qwik.dev/core";

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

export default component$<BuildLogProps>(({ target, failed, lines, warnings }) => {
  return (
    <section class="build-log" aria-label="Build log">
      <pre>
        $ make {target}
        {failed ? <strong> (failed)</strong> : null}
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
});
