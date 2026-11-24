import { KeyedFor } from "./_unframework/KeyedFor";
import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface CommandMenuProps {
  commands: string[];
}

export interface CommandMenuEvents {
  onRun?: (command: string) => void;
  onDismiss?: () => void;
}

export default function CommandMenu(
  props: CommandMenuProps &
    CommandMenuEvents &
    Omit<ComponentProps<"section">, "commands" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "commands", "onRun", "onDismiss", "class");

  const [active, setActive] = createState(0);
  const [query, setQuery] = createState("");
  let shortcutField: HTMLInputElement | null = null;

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "ArrowDown") {
      setActive((active() + 1) % props.commands.length);
    } else if (event.key === "ArrowUp") {
      setActive((active() + props.commands.length - 1) % props.commands.length);
    } else if (event.key === "Enter") {
      props.onRun?.(props.commands[active()] ?? query());
    } else if (event.key === "Escape") {
      setActive(0);
      props.onDismiss?.();
    }
  }

  function clearShortcut() {
    const input = shortcutField;
    if (input) input.value = "";
  }

  return (
    <section
      class={props.class ? `command-menu ${props.class}` : "command-menu"}
      aria-label="Command menu"
      {...others}
    >
      <form role="search" aria-label="Commands">
        <label>
          Command
          <input
            name="command"
            onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
            onKeyDown={handleKey}
          />
        </label>
      </form>
      <ul aria-label="Suggestions">
        <KeyedFor each={props.commands} by={(command) => command}>
          {(command) => (
            <li aria-current={enumeratedValue(command.index === active() ? "true" : undefined)}>
              {command.value}
            </li>
          )}
        </KeyedFor>
      </ul>
      <label>
        Shortcut name
        <input
          name="shortcut"
          ref={clearedRef(
            (element) => {
              shortcutField = element;
            },
            () => {
              shortcutField = null;
            },
          )}
          onKeyDown={(event) => event.key === "Escape" && clearShortcut()}
        />
      </label>
    </section>
  );
}
