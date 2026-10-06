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

export default function BuildLog({ target, failed, lines, warnings }: BuildLogProps) {
  return (
    <section className="build-log" aria-label="Build log">
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
}
