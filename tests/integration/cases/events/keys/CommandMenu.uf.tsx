import { defineEmits, ref, useTemplateRef } from "unframework";

export interface CommandMenuProps {
  commands: string[];
}

export default function CommandMenu({ commands }: CommandMenuProps) {
  const emit = defineEmits<{ run: [command: string]; dismiss: [] }>();

  const active = ref(0);
  const query = ref("");
  const shortcutField = useTemplateRef<HTMLInputElement>();

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "ArrowDown") {
      active.value = (active.value + 1) % commands.length;
    } else if (event.key === "ArrowUp") {
      active.value = (active.value + commands.length - 1) % commands.length;
    } else if (event.key === "Enter") {
      emit("run", commands[active.value] ?? query.value);
    } else if (event.key === "Escape") {
      active.value = 0;
      emit("dismiss");
    }
  }

  function clearShortcut() {
    const input = shortcutField.value;
    if (input) input.value = "";
  }

  return (
    <section class="command-menu" aria-label="Command menu">
      <form role="search" aria-label="Commands">
        <label>
          Command
          <input
            name="command"
            onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)}
            onKeydown={handleKey}
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
          onKeydown={(event) => event.key === "Escape" && clearShortcut()}
        />
      </label>
    </section>
  );
}
