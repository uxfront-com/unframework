import { $, type QRL, component$, sync$, useSignal } from "@qwik.dev/core";

export interface CommandMenuProps {
  commands: string[];
}

export interface CommandMenuEvents {
  onRun$?: QRL<(command: string) => void>;
  onDismiss$?: QRL<() => void>;
}

export default component$<CommandMenuProps & CommandMenuEvents>(
  ({ commands, onRun$, onDismiss$ }) => {
    const active = useSignal(0);
    const query = useSignal("");
    const shortcutField = useSignal<HTMLInputElement>();

    const handleKey = $((event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        active.value = (active.value + 1) % commands.length;
      } else if (event.key === "ArrowUp") {
        active.value = (active.value + commands.length - 1) % commands.length;
      } else if (event.key === "Enter") {
        onRun$?.(commands[active.value] ?? query.value);
      } else if (event.key === "Escape") {
        active.value = 0;
        onDismiss$?.();
      }
    });

    const clearShortcut = $(() => {
      const input = shortcutField.value ?? null;
      if (input) input.value = "";
    });

    return (
      <section class="command-menu" aria-label="Command menu">
        <form role="search" aria-label="Commands">
          <label>
            Command
            <input
              name="command"
              onInput$={(_, element) => (query.value = (element as HTMLInputElement).value)}
              onKeyDown$={[
                sync$((event: KeyboardEvent) => {
                  if (event.key === "Enter") event.preventDefault();
                }),
                handleKey,
              ]}
            />
          </label>
        </form>
        <ul aria-label="Suggestions">
          {commands.map((command, index) => (
            <li key={command} aria-current={index === active.value ? "true" : undefined}>
              {command}
            </li>
          ))}
        </ul>
        <label>
          Shortcut name
          <input
            name="shortcut"
            ref={shortcutField}
            onKeyDown$={(event) => event.key === "Escape" && clearShortcut()}
          />
        </label>
      </section>
    );
  },
);
