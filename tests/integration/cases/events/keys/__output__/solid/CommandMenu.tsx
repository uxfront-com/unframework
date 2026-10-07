import { For, createSignal, onCleanup } from "solid-js";

export interface CommandMenuProps {
  commands: string[];
}

export interface CommandMenuEvents {
  onRun?: (command: string) => void;
  onDismiss?: () => void;
}

export default function CommandMenu(props: CommandMenuProps & CommandMenuEvents) {
  const [active, setActive] = createSignal(0);
  const [query, setQuery] = createSignal("");
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
    <section class="command-menu" aria-label="Command menu">
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
        <For each={props.commands}>
          {(command, index) => (
            <li aria-current={index() === active() ? "true" : undefined}>{command}</li>
          )}
        </For>
      </ul>
      <label>
        Shortcut name
        <input
          name="shortcut"
          ref={(element) => {
            shortcutField = element;
            onCleanup(() => {
              shortcutField = null;
            });
          }}
          onKeyDown={(event) => event.key === "Escape" && clearShortcut()}
        />
      </label>
    </section>
  );
}
