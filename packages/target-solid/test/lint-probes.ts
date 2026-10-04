// What this target will emit for M1's constructs, written by hand before the emitter does, in the
// shapes of design §5.4: `mergeProps` over `rawProps` and `props.x`, `<Switch>`/`<Match>` and
// `<Show>`, `<For>` with `index()`, a class helper and `classList`, kebab-case style objects
// (number literals as strings). The same three components on every target: a badge (props with
// defaults, a conditional chain, class and style bindings, bound attributes, SVG), a list (nested
// keyed lists, conditionals inside and around them, a root fragment) and a card (the `props` form,
// a typed spread written out key by key, a static style). lint.test.ts pins the L5 configuration
// against them (ADR-0042): a rule that rejects one of them would force an emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
  "Badge.tsx": `import { Match, mergeProps, Switch } from "solid-js";

export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
}

export default function Badge(rawProps: BadgeProps) {
  const props = mergeProps({ tone: "info", pill: false } satisfies Partial<BadgeProps>, rawProps);
  return (
    <span
      id="badge"
      class={cx(["badge", { pill: props.pill }, \`tone-\${props.tone}\`])}
      style={{ color: "red", "line-height": "1.5", "margin-top": props.gap, "--gap": props.gap }}
      aria-hidden={props.quiet}
      data-tone={props.tone}
      title={props.label}
    >
      <Switch>
        <Match when={props.count !== undefined && props.count > 0}>
          <strong>{props.count}</strong>
        </Match>
        <Match when={props.tone === "warn"}>!</Match>
      </Switch>
      {props.label}{" "}
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <title>Icon</title>
        <circle cx="8" cy="8" r="4" stroke-width="2" />
        <path d="M0 0h16" />
      </svg>
      <input id="count" type="number" disabled={props.quiet} tabindex="0" maxlength="10" readonly />
      <label for="count">Count</label>
    </span>
  );
}

/** Joins class names as Vue's \`:class\` does: strings, arrays, and the keys of truthy entries. */
function cx(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(cx).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join(" ");
  }
  return "";
}
`,
  "LinkCard.tsx": `interface LinkAttrs {
  href: string;
  title?: string;
  class?: string;
}

export interface LinkCardProps {
  label: string;
  link: LinkAttrs;
  extra?: { id?: string; role?: string };
  accent?: string;
}

export default function LinkCard(props: LinkCardProps) {
  return (
    <div class={cx(["card", props.accent])} style={{ padding: "4px", border: "1px solid" }}>
      <a href={props.link.href} title={props.link.title} class={cx(["card-link", props.link.class])}>
        {props.label}
      </a>
      <p id={props.extra?.id} role={props.extra?.role}>
        More
      </p>
    </div>
  );
}

/** Joins class names as Vue's \`:class\` does: strings, arrays, and the keys of truthy entries. */
function cx(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(cx).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join(" ");
  }
  return "";
}
`,
  "TodoList.tsx": `import { For, Show } from "solid-js";

interface Todo {
  id: string;
  title: string;
  done?: boolean;
  tags: string[];
}

export interface TodoListProps {
  todos: Todo[];
  heading?: string;
}

export default function TodoList(props: TodoListProps) {
  return (
    <>
      <Show when={props.heading}>
        <h2>{props.heading}</h2>
      </Show>
      <Show when={props.todos.length > 0} fallback={<p>Nothing to do.</p>}>
        <ol class="todos">
          <For each={props.todos}>
            {(todo, index) => (
              <li classList={{ done: Boolean(todo.done) }}>
                {index() + 1}. {todo.title}
                <Show when={todo.tags.length > 0}>
                  <ul>
                    <For each={todo.tags}>{(tag) => <li>{tag}</li>}</For>
                  </ul>
                </Show>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </>
  );
}
`,
};
