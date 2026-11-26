import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

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
  props: BuildLogProps &
    Omit<
      ComponentProps<"section">,
      "target" | "failed" | "lines" | "warnings" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "target", "failed", "lines", "warnings", "class");

  return (
    <section
      class={props.class ? `build-log ${props.class}` : "build-log"}
      aria-label="Build log"
      {...others}
    >
      <pre>
        $ make {props.target}
        <Show when={props.failed}>
          <strong> (failed)</strong>
        </Show>
        {"\n"}
        <KeyedFor each={props.lines ?? []} by={(line) => line.id}>
          {(line) => (
            <code>
              {line.value.text}
              {"\n"}
            </code>
          )}
        </KeyedFor>
      </pre>
      <ul aria-label="Warnings">
        <KeyedFor each={props.warnings ?? []} by={(warning) => warning}>
          {(warning) => <li>{warning.value}</li>}
        </KeyedFor>
      </ul>
    </section>
  );
}
