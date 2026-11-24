import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface Entry {
  id: string;
  label: string;
}

export interface ChecklistProps {
  entries: Entry[];
}

export default function Checklist(
  props: ChecklistProps &
    Omit<ComponentProps<"ul">, "entries" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "entries", "class");

  return (
    <ul class={props.class ? `checklist ${props.class}` : "checklist"} {...others}>
      <KeyedFor each={props.entries} by={(entry) => entry.id}>
        {(entry) => (
          <li>
            <label>
              {entry.value.label}
              <input name={`note-${entry.value.id}`} aria-label={`Note for ${entry.value.label}`} />
            </label>
          </li>
        )}
      </KeyedFor>
    </ul>
  );
}
