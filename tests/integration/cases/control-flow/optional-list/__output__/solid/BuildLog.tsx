import { For, type JSX, Show } from "solid-js";

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

export default function BuildLog(
  props: BuildLogProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `build-log ${props.class}` : "build-log"}
      aria-label="Build log"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <pre>
        $ make {props.target}
        <Show when={props.failed}>
          <strong> (failed)</strong>
        </Show>
        {"\n"}
        <For each={props.lines ?? []}>
          {(line) => (
            <code>
              {line.text}
              {"\n"}
            </code>
          )}
        </For>
      </pre>
      <ul aria-label="Warnings">
        <For each={props.warnings ?? []}>{(warning) => <li>{warning}</li>}</For>
      </ul>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
