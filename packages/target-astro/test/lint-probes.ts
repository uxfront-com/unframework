// What this target will emit for M1's constructs, written by hand before the emitter does, in the
// shapes it emits: frontmatter with the types, `type Props` and a destructure of
// `Astro.props` (or `props`), ternaries with `null`, `.map` without keys, `class:list`, style
// objects. The same three components on every target: a badge (props with defaults, a conditional
// chain, class and style bindings, bound attributes, SVG), a list (nested keyed lists, conditionals
// inside and around them, a root fragment) and a card (the `props` form, a typed spread written out
// key by key, a static style). lint.test.ts pins the L5 configuration against them (ADR-0042): a
// rule that rejects one of them would force an emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
  "Badge.astro": `---
export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
}

type Props = BadgeProps;

const { label, tone = "info", count, pill = false, gap, quiet } = Astro.props;
---

<span
  id="badge"
  class:list={["badge", { pill }, \`tone-\${tone}\`]}
  style={{ color: "red", lineHeight: 1.5, marginTop: gap, "--gap": gap }}
  aria-hidden={quiet}
  data-tone={tone}
  title={label}
>
  {count !== undefined && count > 0 ? <strong>{count}</strong> : tone === "warn" ? "!" : null}
  {label}
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <title>Icon</title>
    <circle cx="8" cy="8" r="4" stroke-width="2" />
    <path d="M0 0h16" />
  </svg>
  <input id="count" type="number" disabled={quiet} tabindex="0" maxlength="10" readonly />
  <label for="count">Count</label>
</span>
`,
  "LinkCard.astro": `---
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

type Props = LinkCardProps;

const props = Astro.props;
---

<div class:list={["card", props.accent]} style="padding: 4px; border: 1px solid">
  <a href={props.link.href} title={props.link.title} class:list={["card-link", props.link.class]}
    >{props.label}</a
  >
  <p id={props.extra?.id} role={props.extra?.role}>More</p>
</div>
`,
  "TodoList.astro": `---
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

type Props = TodoListProps;

const { todos, heading } = Astro.props;
---

{heading ? <h2>{heading}</h2> : null}
{
  todos.length > 0 ? (
    <ol class="todos">
      {todos.map((todo, index) => (
        <li class:list={[{ done: todo.done }]}>
          {index + 1}. {todo.title}
          {todo.tags.length > 0 ? (
            <ul>
              {todo.tags.map((tag) => (
                <li>{tag}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  ) : (
    <p>Nothing to do.</p>
  )
}
`,
};

/**
 * What this target emits for M2's setup (ADR-0046), formatted as the compiler writes it:
 * `ref`s as their initial value, cast to the `ref`'s type; `computed`s as their value, a block
 * getter as a local function called once; the `useId` helper, a counter on `Astro.locals`. Client
 * code is dropped, with what only it reads. `test/setup.test.ts` pins the emitter to these
 * shapes, and lint.test.ts the L5 configuration against them (ADR-0042).
 */
export const M2_SHAPES: Readonly<Record<string, string>> = {
  "Counter.astro": `---
export interface CounterProps {
  initial?: number;
  step?: number;
}

type Props = CounterProps;

const { initial = 0 } = Astro.props;

const count = initial;
const doubled = count * 2;
---

<div class="counter">
  <output>{count}</output>
  {doubled > 10 ? (
    <span>Big</span>
  ) : null}
  <button type="button">Add</button>
</div>
`,
  "Casts.astro": `---
type Status = "idle" | "busy";

interface Item {
  name: string;
}

const count = 0 as number;
const offset = -1 as number;
const title = "Draft" as string;
const open = false as boolean;
const status = "idle" as Status;
const picked = undefined as Item | undefined;
const items = [] as Item[];
const tags = ["a", "b"];
---

<dl>
  <dt>{count === 5 ? "five" : count}</dt>
  <dd>{offset + 1}</dd>
  <dd>{title === "Final" ? "final" : title}</dd>
  <dd>{open === true ? "open" : "closed"}</dd>
  <dd>{status === "busy" ? "busy" : "idle"}</dd>
  <dd>{picked?.name ?? "none"}</dd>
  <dd>{items.length}</dd>
  <dd>{tags.join(", ")}</dd>
</dl>
`,
  "Price.astro": `---
export type Tier = "low" | "high";

export interface PriceProps {
  price: number;
}

type Props = PriceProps;

const { price } = Astro.props;

const quantity = 2 as number;
const total = quantity * price;
const unit = "EUR" as string;

function getTier(): Tier {
  if (total > 100) return "high";
  return "low";
}

const tier = getTier();

function getLabel(): string {
  const amount = (total / 100).toFixed(2);
  return \`\${amount} \${unit}\`;
}

const label = getLabel();
---

<p data-tier={tier}>{label} {unit === "USD" ? "(US)" : "(EU)"}</p>
`,
  "Field.astro": `---
export interface FieldProps {
  label: string;
}

type Props = FieldProps;

const { label } = Astro.props;

function uniqueId(): string {
  const locals = Astro.locals as { ufIdCount?: number };
  locals.ufIdCount = (locals.ufIdCount ?? 0) + 1;
  return \`uf-id-\${locals.ufIdCount}\`;
}

const inputId = uniqueId();
const hintId = uniqueId();
---

<div>
  <label for={inputId}>{label}</label>
  <input id={inputId} aria-describedby={hintId} />
  <p id={hintId}>Required</p>
</div>
`,
};
