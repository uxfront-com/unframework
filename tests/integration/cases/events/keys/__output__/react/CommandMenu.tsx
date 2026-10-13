import { type CSSProperties, type KeyboardEvent, useRef, useState } from "react";

export interface CommandMenuProps {
  commands: string[];
}

export interface CommandMenuEvents {
  onRun?: (command: string) => void;
  onDismiss?: () => void;
}

export interface CommandMenuAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function CommandMenu({
  commands,
  onRun,
  onDismiss,
  className,
  style,
}: CommandMenuProps & CommandMenuEvents & CommandMenuAttributes) {
  const [active, setActive] = useState(0);
  const activeRef = useRef(active);
  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const shortcutField = useRef<HTMLInputElement>(null);

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "ArrowDown") {
      activeRef.current = (activeRef.current + 1) % commands.length;
      setActive(activeRef.current);
    } else if (event.key === "ArrowUp") {
      activeRef.current = (activeRef.current + commands.length - 1) % commands.length;
      setActive(activeRef.current);
    } else if (event.key === "Enter") {
      onRun?.(commands[activeRef.current] ?? queryRef.current);
    } else if (event.key === "Escape") {
      activeRef.current = 0;
      setActive(activeRef.current);
      onDismiss?.();
    }
  }

  function clearShortcut() {
    const input = shortcutField.current;
    if (input) input.value = "";
  }

  return (
    <section className={cx("command-menu", className)} aria-label="Command menu" style={style}>
      <form role="search" aria-label="Commands">
        <label>
          Command
          <input
            name="command"
            onInput={(event) => {
              queryRef.current = (event.currentTarget as HTMLInputElement).value;
              setQuery(queryRef.current);
            }}
            onKeyDown={handleKey}
          />
        </label>
      </form>
      <ul aria-label="Suggestions">
        {commands.map((command, index) => (
          <li key={command} aria-current={index === active ? "true" : undefined}>
            {command}
          </li>
        ))}
      </ul>
      <label>
        Shortcut name
        <input
          name="shortcut"
          ref={shortcutField}
          onKeyDown={(event) => event.key === "Escape" && clearShortcut()}
        />
      </label>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
