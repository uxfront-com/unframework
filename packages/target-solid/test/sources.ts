// Sources that between them reach every shape the Solid emitter prints (design §5.4): props
// with and without defaults, the object form, control flow, every attribute kind, SVG, a root
// fragment, and the Solid-specific rewrites (`<Show>` for an interpolated name, the `<pre>`
// line feed). test/output.test.ts runs Solid's compiler, its types and its lint over their
// output.

/** File name (without `.uf.tsx`) → source. */
export const SOURCES: Readonly<Record<string, string>> = {
  Badge: `export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
  tags?: string[];
}

export default function Badge({
  label,
  tone = "info",
  count,
  pill = false,
  gap,
  quiet,
  tags = [],
}: BadgeProps) {
  return (
    <span
      id="badge"
      class={["badge", { pill, quiet }, \`tone-\${tone}\`]}
      style={{ color: "red", lineHeight: 1.5, marginTop: gap, "--gap": gap, zIndex: -1 }}
      aria-hidden={quiet}
      data-tone={tone}
      title={label}
    >
      {count !== undefined && count > 0 ? <strong>{count}</strong> : tone === "warn" ? <em>!</em> : null}
      {label}{" "}
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <title>Icon</title>
        <circle cx="8" cy="8" r="4" stroke-width={count} />
      </svg>
      <input id="count" type="number" disabled={quiet} tabindex="0" maxlength="10" readonly />
      <label for="count">{tags.join(", ")}</label>
    </span>
  );
}
`,
  LinkCard: `interface LinkAttrs {
  href: string;
  title?: string;
  class?: string;
}

export interface LinkCardProps {
  label: string;
  link: LinkAttrs;
  extra?: { id?: string; role?: "note" | "status" };
  accent?: string | null;
  active: boolean;
}

export function LinkCard(props: LinkCardProps) {
  return (
    <div class={["card", props.accent]} style="padding: 4px; border: 1px solid">
      <a class="card-link" {...props.link}>
        {props.label}
      </a>
      <p {...props.extra} class={{ active: props.active }}>
        More
      </p>
      <p class={props.active ? "on" : "off"}>{props.active ? "On" : "Off"}</p>
      <p>{props.active ? <b>Active</b> : "Inactive"}</p>
      <p title={props.active ? 'say "hi"' : props.label}>{props.active ? "<b>" : props.label}</p>
    </div>
  );
}
`,
  TodoList: `interface Todo {
  id: string;
  title: string;
  done?: boolean;
  tags: string[];
}

export interface TodoListProps {
  todos: Todo[];
  heading?: string;
  busy: boolean;
  empty?: string;
}

export default function TodoList({ todos, heading, busy, empty = "Nothing to do." }: TodoListProps) {
  return (
    <>
      {heading && <h2>{heading}</h2>}
      {busy ? null : <p>Ready</p>}
      {todos.length > 0 ? (
        <ol class="todos">
          {todos.map((todo, index) => (
            <li key={todo.id} class={{ done: todo.done }}>
              {index + 1}. {todo.done ? todo.title : "untitled"}
              {todo.tags.length > 0 && (
                <ul>
                  {todo.tags.map((tag, position) => (
                    <li key={position}>{position > 0 ? tag : "first"}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p>{empty}</p>
      )}
    </>
  );
}
`,
  Address: `export interface AddressProps {
  name: string;
  street: string;
  city?: string;
}

export default function Address({ name, street, city }: AddressProps) {
  return (
    <pre>
      {name}
      {"\\n"}
      {street}
      {"\\n"}
      {city ?? "-"}
    </pre>
  );
}
`,
  Swatch: `interface Paint {
  fill?: string;
  id?: string;
}

export interface SwatchProps {
  colour: string;
  turn: string;
  paint: Paint;
  order: number;
}

export default function Swatch({ colour, turn, paint, order }: SwatchProps) {
  return (
    <div>
      <svg viewBox="0 0 8 8" role="img">
        <title>Swatch</title>
        <defs>
          <linearGradient id="swatch-fill" opacity="0.5" transform={turn}>
            <stop offset="0" fill={colour} />
            <stop {...paint} />
          </linearGradient>
        </defs>
        <path id="swatch-path" d="M0 0h8" />
        <mpath href="#swatch-path" />
      </svg>
      <dialog open tabindex={order}>
        Picked
      </dialog>
    </div>
  );
}
`,
  Plain: `export default function Plain(_: { note?: string }) {
  return <p>Nothing to read.</p>;
}
`,
  // Branches that read what their tests narrow (src/narrowing.ts), each the source's ternary:
  // truthiness, a negation, a chain, an `&&` whose left side is a string, reads inside the
  // branch (a ternary in an attribute, a class toggle, a nested <Show>), `?.`, a list's item,
  // comparisons, `typeof`, string, template-literal and boolean discriminants, a static text
  // branch the server would not escape, an object default (`mergeProps`), an else that reads
  // through `?.` what its test reads only where it holds, a list's callback and an arrow
  // that read a narrowed prop, and branches of one interpolation that read another prop.
  Narrowing: `interface Account {
  name: string;
  nick?: string;
  admin?: boolean;
  colour?: string;
  age?: number;
  tags: string[];
  address?: { city: string };
  link?: { href: string; lang?: string };
}

interface Circle {
  kind: "circle";
  r: number;
}

interface Square {
  kind: "square";
  side: number;
}

interface Ok {
  ok: true;
  value: string;
}

interface Failed {
  ok: false;
  error: string;
}

interface Format {
  separator: "," | ";" | null;
}

interface Attrs {
  title: string;
  id?: string;
}

export interface NarrowingProps {
  user?: Account;
  note?: string | null;
  rows: (Account | null)[];
  ready: boolean;
  places: string[];
  count?: number;
  value: string | number | null;
  shape: Circle | Square;
  result: Ok | Failed;
  label: string;
  format: Format;
  attrs?: Attrs;
}

export default function Narrowing({
  user,
  note,
  rows,
  ready,
  places,
  count,
  value,
  shape,
  result,
  label,
  format,
  attrs = { title: "t" },
}: NarrowingProps) {
  return (
    <div>
      {user && <p>{user.name}</p>}
      {user ? <b title={user.name}>{user.name}</b> : <i>anon</i>}
      {user ? <p>{user.name}</p> : note ? <em>{note.trim()}</em> : <i>none</i>}
      {!ready ? <i>wait</i> : !user ? <i>anon</i> : user.admin ? <b>{user.name}</b> : <p>{user.name}</p>}
      {user && user.admin && <b>{user.name}</b>}
      {label && user && <p>{user.name}</p>}
      {user && (
        <p
          title={user.nick ? user.nick.trim() : "none"}
          class={{ grown: user.age !== undefined && user.age > 17 }}
          style={{ color: user.colour }}
        >
          {user.age !== undefined ? user.age.toFixed() : "-"}
          {ready && <b>{user.name}</b>}
        </p>
      )}
      {user?.address?.city && <p>{user.address.city}</p>}
      {user && (
        <a {...user.link} data-json={JSON.stringify({ user })}>
          {user.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </a>
      )}
      <ul>
        {rows.map((row, index) => (
          <li key={index}>
            {row && row.name}
            {index > 0 && row ? <b>{row.name}</b> : "-"}
            {row && row.age !== undefined && <s>{Math.round(row.age)}</s>}
          </li>
        ))}
      </ul>
      {count !== undefined && <b title={String(count)}>{Math.round(count)}</b>}
      {count === undefined ? <i>none</i> : <u>{count.toFixed(1)}</u>}
      {note != null && <i title={note}>{note}</i>}
      {typeof value === "string" ? <b>{value.toUpperCase()}</b> : value !== null ? <i>{value.toFixed(1)}</i> : null}
      <svg>{shape.kind === \`circle\` ? <circle r={shape.r} /> : <rect width={shape.side} />}</svg>
      {result.ok ? <p>{result.value}</p> : <p>{result.error}</p>}
      {format.separator !== null && <b>{format.separator.repeat(2)}</b>}
      <ul>
        {places.map((place) => (
          <li key={place}>{place === "x" && user && <i>{user.name}</i>}</li>
        ))}
      </ul>
      {user ? <p>{user.name}</p> : "<anonymous>"}
      <p {...attrs}>a</p>
      {user && user.name.length > 2 ? <p>{user.name}</p> : <p>{user?.name ?? "anon"}</p>}
      {user && <ul>{places.map((place) => <li key={place}>{user.name}: {place}</li>)}</ul>}
      {user && <p>{places.map((place) => user.name + place).join(", ")}</p>}
      <p>{user && user.name + label}</p>
      <p>{count !== undefined && count.toFixed(1) + label}</p>
    </div>
  );
}
`,
  // Literal types: unions with a falsy literal (`""`, `0`), which a truthiness test removes and
  // Solid's keyed `NonNullable<T>` keeps, so each `when` that is the test is `test || undefined`;
  // and array defaults of literal-union values, whose literal type `satisfies` would keep.
  Literals: `type Tone = "info" | "warn";

export interface LiteralsProps {
  limit: number | "";
  rows: (0 | { n: number })[];
  box: { limit?: number | "" };
  tones?: Tone[];
  sizes?: (1 | 2 | 3)[];
  tone: Tone;
  size: 1 | 2 | 3;
}

export default function Literals({ limit, rows, box, tones = ["info"], sizes = [1, 2], tone, size }: LiteralsProps) {
  return (
    <div>
      {limit && <p>{limit.toFixed(1)}</p>}
      {!limit ? <i>none</i> : <b>{limit.toFixed(0)}</b>}
      {limit ? <p>{limit.toFixed(2)}</p> : tone === "warn" ? <i>w</i> : <b>b</b>}
      <ul>{rows.map((row, index) => <li key={index}>{row && <b>{row.n}</b>}</li>)}</ul>
      {box.limit && <p>{box.limit.toFixed(1)}</p>}
      <p>{tones.includes(tone) ? "y" : "n"}{sizes.indexOf(size)}</p>
    </div>
  );
}
`,
  // Narrowing forms the analyser accepts (packages/analyzer/test/narrowing.test.ts and its spread
  // cases in bindings.test.ts), which every target's checker narrows, Solid's included: a
  // destructured prop read in a list's callback or an arrow, which TypeScript narrows there as a
  // parameter, and a property of one through `?.`, as TypeScript forgets a property's narrowing
  // in a callback; and elses that read through `?.` what their tests read only where they hold.
  NarrowingForms: `interface Inner {
  title: string;
  other?: string;
}
interface Box {
  inner?: Inner;
  items?: string[];
  name?: string;
}
interface Attrs {
  id: string;
  title?: string;
}
interface SpreadBox {
  inner?: Attrs;
}

export interface NarrowingFormsProps {
  box: Box;
  items: string[];
  maybe?: Inner;
  on: boolean;
  rows: Box[];
  count?: number;
  note?: string | null;
  value?: string | number;
  linkAttrs?: Attrs;
  list: Attrs[];
  sbox: SpreadBox;
  tone?: "info" | "warn";
}

export default function NarrowingForms({ box, items, maybe, on, rows, count, note, value, linkAttrs, list, sbox, tone }: NarrowingFormsProps) {
  return (
    <div>
      {box.inner && <p title={box.inner.title}>x</p>}
      {!box.inner ? <i>n</i> : <p title={box.inner.title}>x</p>}
      {on && box.inner ? <p title={box.inner.title}>x</p> : <i>n</i>}
      {on ? <i>a</i> : box.inner ? <p title={box.inner.title}>x</p> : null}
      {box.inner && <div>{on && <p title={box.inner.title}>x</p>}</div>}
      {on && box.inner && on && <p title={box.inner.title}>x</p>}
      {maybe && <ul>{items.map((i) => <li key={i}>{maybe.title}</li>)}</ul>}
      {maybe && <p>{items.map((i) => maybe.title + i).join()}</p>}
      {box.inner?.title && <p title={box.inner.title}>x</p>}
      <p title={box.inner !== undefined ? box.inner.title : ""}>x</p>
      <p title={box.inner?.title ? box.inner.other : ""}>x</p>
      {box.inner && <p>{items.filter((i) => i === box.inner?.title).length}</p>}
      {box.inner && <p title={box.name ?? box.inner.title}>x</p>}
      {box.inner && on ? <p title={box.inner.title}>x</p> : <i>n</i>}
      {on ? <i>a</i> : box.inner && on ? <p title={box.inner.title}>x</p> : null}
      {box.inner?.title && <p title={box.inner.other}>x</p>}
      {box.inner !== undefined && <p title={box.inner.title}>x</p>}
      {box.inner === undefined ? <i>n</i> : <p title={box.inner.title}>x</p>}
      {count !== undefined && count > 0 && <p>{count.toFixed(1)}</p>}
      {count != null ? <p>{count.toFixed(1)}</p> : <i>n</i>}
      {note != null && <p>{note.trim()}</p>}
      {box.inner?.title === "t" && <p title={box.inner.other}>x</p>}
      {typeof value === "string" ? <p>{value.trim()}</p> : <i>{value}</i>}
      {Array.isArray(box.items) && <p>{box.items.join()}</p>}
      {tone === "warn" && <p>{tone.toUpperCase()}</p>}
      {count !== undefined && <ul>{items.map((i) => <li key={i}>{count.toFixed(1)}</li>)}</ul>}
      {box.items && <ul>{box.items.map((i) => <li key={i}>{i}</li>)}</ul>}
      {linkAttrs && <p {...linkAttrs}>x</p>}
      {(linkAttrs && on) ? <p {...linkAttrs}>x</p> : null}
      {on ? null : !sbox.inner ? <i>y</i> : <p {...sbox.inner}>x</p>}
      {sbox.inner ? <p {...sbox.inner}>x</p> : <i>y</i>}
      {sbox.inner !== undefined && <p {...sbox.inner}>x</p>}
      {linkAttrs?.id && <p {...linkAttrs}>x</p>}
      {linkAttrs && on ? <p {...linkAttrs}>x</p> : <i>y</i>}
      {on ? <i>y</i> : linkAttrs && on ? <p {...linkAttrs}>x</p> : null}
      {linkAttrs && <ul>{list.map((item) => <li key={item.id} {...linkAttrs}>x</li>)}</ul>}
      <ul>{list.map((item) => <li key={item.id}>{sbox.inner && <p {...sbox.inner}>x</p>}</li>)}</ul>
      <ul>{rows.map((row, k) => <li key={k}>{row.inner && <b title={row.inner.title}>x</b>}</li>)}</ul>
      {box.inner && box.inner.title.length > 3 ? <p>{box.inner.title}</p> : <p>{box.inner?.title ?? "anon"}</p>}
      {box.inner?.title === "t" ? <p>{box.inner.other}</p> : <i>{box.inner?.title}</i>}
      {typeof box.inner?.other === "string" && <p>{box.inner.other.trim()}</p>}
      {box.inner?.other != null ? <p>{box.inner.other.trim()}</p> : <i>{box.inner?.other}</i>}
      {box.inner?.other !== undefined && <p>{box.inner.other.trim()}</p>}
      {!box.inner || on ? <i>{box.inner?.title}</i> : <p title={box.inner.title}>x</p>}
      {on ? <i>a</i> : box.inner && box.inner.title ? <p>{box.inner.title}</p> : <i>{box.inner?.other}</i>}
      <ul>{rows.map((row, k) => <li key={k}>{row.inner?.other ? <b>{row.inner.other}</b> : <i>{row.inner?.title}</i>}</li>)}</ul>
      <ul>{rows.map((row, k) => <li key={k}>{row.inner && row.inner.title.length > 3 ? <b>{row.inner.title}</b> : <i>{row.inner?.title}</i>}</li>)}</ul>
      {maybe?.other ? <p>{maybe.other.trim()}</p> : <i>{maybe?.title}</i>}
      {on ? <i>a</i> : maybe?.other ? <p>{maybe.other.trim()}</p> : maybe ? <b>{maybe.title}</b> : null}
      {maybe && maybe.title.length > 3 && on ? <p>{maybe.title}</p> : on ? <i>{maybe?.title}</i> : <b>{maybe?.other}</b>}
      {typeof box.inner?.other !== "undefined" && <p>{box.inner.other.trim()}</p>}
      {typeof box.inner?.other === "undefined" ? <i>none</i> : <p>{box.inner.other.trim()}</p>}
      {box.name && <p>{box.name}{box.inner && <b>{box.inner.title}{box.name}</b>}</p>}
      {maybe?.other && <p>{maybe.other}{maybe.title && <b>{maybe.title}{maybe.other}</b>}</p>}
      {box[\`name\`] && <p>{box[\`name\`].trim()}</p>}
    </div>
  );
}
`,
};
