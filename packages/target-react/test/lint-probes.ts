// What this target emits for M1's constructs, written by hand in the shapes of design §5.1 (kept
// in step with the emitter's): destructured props with defaults, ternary chains with `null`,
// keyed `.map`, `className` through an inline `cx`, a style object (`as CSSProperties` for a
// custom property), React's attribute names and number-typed attributes. The same three components on
// every target: a badge (props with defaults, a conditional chain, class and style bindings, bound
// attributes, SVG), a list (nested keyed lists, conditionals inside and around them, a root
// fragment) and a card (the `props` form, a typed spread written out key by key, a static style).
// lint.test.ts pins the L5 configuration against them (ADR-0042): a rule that rejects one of them
// would force an emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
  "Badge.tsx": `import type { CSSProperties } from "react";

export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
}

export default function Badge({ label, tone = "info", count, pill = false, gap, quiet }: BadgeProps) {
  return (
    <span
      id="badge"
      className={cx("badge", { pill }, \`tone-\${tone}\`)}
      style={{ color: "red", lineHeight: 1.5, marginTop: gap, "--gap": gap } as CSSProperties}
      aria-hidden={quiet}
      data-tone={tone}
      title={label}
    >
      {count !== undefined && count > 0 ? <strong>{count}</strong> : tone === "warn" ? "!" : null}
      {label}{" "}
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <title>Icon</title>
        <circle cx="8" cy="8" r="4" strokeWidth="2" />
        <path d="M0 0h16" />
      </svg>
      <input id="count" type="number" disabled={quiet} tabIndex={0} maxLength={10} readOnly />
      <label htmlFor="count">Count</label>
    </span>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one \`className\`. */
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
    <div className={cx("card", props.accent)} style={{ padding: "4px", border: "1px solid" }}>
      <a href={props.link.href} title={props.link.title} className={cx("card-link", props.link.class)}>
        {props.label}
      </a>
      <p id={props.extra?.id} role={props.extra?.role}>
        More
      </p>
    </div>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one \`className\`. */
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
`,
  "TodoList.tsx": `interface Todo {
  id: string;
  title: string;
  done?: boolean;
  tags: string[];
}

export interface TodoListProps {
  todos: Todo[];
  heading?: string;
}

export default function TodoList({ todos, heading }: TodoListProps) {
  return (
    <>
      {heading ? <h2>{heading}</h2> : null}
      {todos.length > 0 ? (
        <ol className="todos">
          {todos.map((todo, index) => (
            <li key={todo.id} className={cx({ done: todo.done })}>
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
}

/** Joins class names, and the keys of an object's truthy entries, into one \`className\`. */
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
`,
};
