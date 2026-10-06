// What this target will emit for M1's constructs, written by hand before the emitter does, in the
// shapes of design §5.6: `component$<P>` with destructured defaults or `props`, ternaries and keyed
// `.map`, `class` arrays and objects, style objects, the attribute names Qwik types. The same three
// components on every target: a badge (props with defaults, a conditional chain, class and style
// bindings, bound attributes, SVG), a list (nested keyed lists, conditionals inside and around
// them, a root fragment) and a card (the `props` form, a typed spread written out key by key, a
// static style). lint.test.ts pins the L5 configuration against them (ADR-0042): a rule that
// rejects one of them would force an emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
  "Badge.tsx": `import { component$ } from "@qwik.dev/core";

export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
}

export default component$<BadgeProps>(({ label, tone = "info", count, pill = false, gap, quiet }) => {
  return (
    <span
      id="badge"
      class={["badge", { pill }, \`tone-\${tone}\`]}
      style={{ color: "red", lineHeight: 1.5, marginTop: gap, "--gap": gap }}
      aria-hidden={quiet}
      data-tone={tone}
      title={label}
    >
      {count !== undefined && count > 0 ? <strong>{count}</strong> : tone === "warn" ? "!" : null}
      {label}{" "}
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <title>Icon</title>
        <circle cx="8" cy="8" r="4" stroke-width="2" />
        <path d="M0 0h16" />
      </svg>
      <input id="count" type="number" disabled={quiet} tabIndex={0} maxLength={10} readOnly />
      <label for="count">Count</label>
    </span>
  );
});
`,
  "LinkCard.tsx": `import { component$ } from "@qwik.dev/core";

interface LinkAttrs {
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

export default component$<LinkCardProps>((props) => {
  return (
    <div class={["card", props.accent]} style={{ padding: "4px", border: "1px solid" }}>
      <a href={props.link.href} title={props.link.title} class={["card-link", props.link.class]}>
        {props.label}
      </a>
      <p id={props.extra?.id} role={props.extra?.role}>
        More
      </p>
    </div>
  );
});
`,
  "TodoList.tsx": `import { component$ } from "@qwik.dev/core";

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

export default component$<TodoListProps>(({ todos, heading }) => {
  return (
    <>
      {heading ? <h2>{heading}</h2> : null}
      {todos.length > 0 ? (
        <ol class="todos">
          {todos.map((todo, index) => (
            <li key={todo.id} class={{ done: Boolean(todo.done) }}>
              {index + 1}. {todo.title}
              {todo.tags.length > 0 ? (
                <ul>
                  {todo.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p>Nothing to do.</p>
      )}
    </>
  );
});
`,
};
