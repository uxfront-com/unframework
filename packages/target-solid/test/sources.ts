// Sources that between them reach every shape the Solid emitter prints: props with and without
// defaults, the object form, control flow, every attribute kind, SVG, a root
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
  // M2 (ADR-0045 to ADR-0049): every watcher the helper takes (one source and an array, lazy
  // and immediate, the array's values annotated as a mutable tuple), `watchEffect` with a cleanup
  // parameter named otherwise, writes the scheduler coalesces, and emits.
  Watchers: `import { defineEmits, ref, watch, watchEffect } from "unframework";

export interface WatchersProps {
  label: string;
}

export default function Watchers({ label }: WatchersProps) {
  const emit = defineEmits<{
    queryRun: [value: string, previous: string];
    pageRun: [value: number, previous: number];
    left: [name: string];
    span: [values: number[], previous: number[]];
    labelled: [value: string, previous?: string];
    effect: [title: string];
    released: [title: string];
  }>();

  const query = ref("");
  const page = ref(1);
  const low = ref(10);
  const high = ref(50);

  watch(query, (value, previous, onCleanup) => {
    emit("queryRun", value, previous);
    onCleanup(() => {
      emit("left", value);
    });
  });

  watch(
    () => page.value * 2,
    (value, previous) => {
      emit("pageRun", value, previous);
    },
  );

  watch([low, high], ([minimum, maximum]: [number, number], [lastMinimum, lastMaximum]) => {
    emit("span", [minimum, maximum], [lastMinimum, lastMaximum]);
  });

  watch(
    () => label,
    (value, previous) => {
      emit("labelled", value, previous);
    },
    { immediate: true },
  );

  watchEffect((cleanup) => {
    const title = \`\${query.value} \${label}\`;
    emit("effect", title);
    cleanup(() => {
      emit("released", title);
    });
  });

  function search(term: string) {
    query.value = term;
    query.value = query.value.toLowerCase();
  }

  function turnTwice() {
    page.value += 1;
    page.value += 1;
  }

  function shift() {
    low.value += 10;
    high.value += 10;
  }

  function wobble() {
    low.value += 1;
    low.value -= 1;
  }

  return (
    <section aria-label="Watchers">
      <p role="status">
        {query.value} {page.value} {low.value}-{high.value}
      </p>
      <button type="button" onClick={() => search("Boots")}>
        Boots
      </button>
      <button type="button" onClick={turnTwice}>
        Turn
      </button>
      <button type="button" onClick={shift}>
        Shift
      </button>
      <button type="button" onClick={wobble}>
        Wobble
      </button>
    </section>
  );
}
`,
  // Listeners: Solid's event props, options as native listeners, the plain listeners of an event
  // the component also listens to once made native, two listeners of one event on one element
  // (the second added from its `ref` callback, with a template ref), a plain and a once listener
  // of one phase in both orders (both added from the `ref` callback), and `focus`/`change`.
  Listeners: `import { defineEmits, ref, useTemplateRef } from "unframework";

export default function Listeners() {
  const emit = defineEmits<{ logged: [entries: string[]] }>();

  const log = ref<string[]>([]);
  const volume = ref(0);
  const field = useTemplateRef<HTMLInputElement>();

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function scroll(event: WheelEvent) {
    volume.value += event.deltaY < 0 ? 1 : -1;
  }

  function report() {
    record("report");
    emit("logged", log.value);
  }

  return (
    <section aria-label="Listeners">
      <div
        role="presentation"
        onClickCapture={() => record("capture")}
        onClick={() => record("bubble")}
      >
        <button type="button" onClick={() => record("inside")}>
          Inside
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop
        </button>
        <button type="button" onClickOnce={() => record("once")}>
          Once
        </button>
      </div>
      <button type="button" onClickCapture={() => record("own capture")} onClick={report}>
        Report
      </button>
      <button type="button" onClick={() => record("plain")} onClickOnce={() => record("first")}>
        Pair
      </button>
      <button type="button" onClickOnce={() => record("first swap")} onClick={() => record("swap")}>
        Swap
      </button>
      <div role="group" aria-label="Volume" onWheelPassive={scroll}>
        <output>{volume.value}</output>
      </div>
      <label>
        Name
        <input
          name="name"
          ref={field}
          onFocus={() => record("focus")}
          onBlur={() => record("blur")}
          onChange={() => record(\`change \${field.value?.value ?? ""}\`)}
          onKeydown={(event) => event.key === "Enter" && record("enter")}
          onKeydownCapture={() => record("key capture")}
        />
      </label>
      <p>{log.value.join(", ")}</p>
    </section>
  );
}
`,
  // Lifecycle, refs and the rest of the setup: hoisted constants and functions, a setup \`let\`,
  // state no code writes, an id, \`onMounted\`/\`onUnmounted\`, a template ref in a branch and
  // one kept in a setup \`let\` typed \`T | null\` for the teardown, an async handler, and
  // \`nextTick\`.
  Lifecycle: `import { defineEmits, nextTick, onMounted, onUnmounted, ref, useId, useTemplateRef } from "unframework";

export interface LifecycleProps {
  title: string;
}

export default function Lifecycle({ title }: LifecycleProps) {
  const emit = defineEmits<{
    ready: [length: number];
    ticked: [count: number];
    toggled: [items: number];
    saved: [attempt: number, status: string];
  }>();

  const units = ["s", "ms"];

  function format(value: number): string {
    return \`\${value}\${units[0]}\`;
  }

  const id = useId();
  const heading = useTemplateRef<HTMLHeadingElement>();
  const details = useTemplateRef<HTMLUListElement>();
  const fixed = ref(format(1));
  const open = ref(false);
  const status = ref("idle");
  const attempts = ref(0);
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticks = 0;
  let headingElement: HTMLHeadingElement | null = null;

  function tick() {
    ticks += 1;
    emit("ticked", ticks);
  }

  async function toggle() {
    open.value = !open.value;
    await nextTick();
    emit("toggled", details.value?.childElementCount ?? 0);
  }

  async function save() {
    status.value = "saving";
    attempts.value += 1;
    await Promise.resolve();
    status.value = "checking";
    attempts.value += 1;
    await nextTick();
    status.value = \`saved \${attempts.value}\`;
    emit("saved", attempts.value, status.value);
  }

  onMounted(() => {
    emit("ready", heading.value?.textContent?.length ?? 0);
    timer = setInterval(tick, 20);
    headingElement = heading.value;
    headingElement?.addEventListener("click", tick);
  });

  onUnmounted(() => {
    clearInterval(timer);
    headingElement?.removeEventListener("click", tick);
  });

  return (
    <section aria-labelledby={id}>
      <h2 id={id} ref={heading}>
        {title}
      </h2>
      <p>
        {fixed.value} {status.value}
      </p>
      <button type="button" onClick={toggle}>
        Details
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      {open.value && (
        <ul ref={details}>
          <li>One</li>
          <li>Two</li>
        </ul>
      )}
    </section>
  );
}
`,
  // Listeners whose event Solid's props type otherwise than the DOM: \`click\` taken as a
  // \`PointerEvent\`, \`encrypted\` off a media element. Each goes through its element's \`ref\`.
  DomTypes: `import { ref } from "unframework";

export default function DomTypes() {
  const last = ref("none");

  function hit(event: PointerEvent) {
    last.value = String(event.button);
  }

  return (
    <div role="presentation" onClick={() => (last.value = "outer")} onEncrypted={() => (last.value = "keys")}>
      <button type="button" onClick={hit}>
        {last.value}
      </button>
      <video onEncrypted={() => (last.value = "video")} />
    </div>
  );
}
`,
  // Where client code's synchronous runs run, each coalesced by the watchers' scheduler: a
  // timer's callback, a promise continuation (untracked, \`solid/reactivity\`), an async
  // function's continuation and its run that declares between two changes; an async
  // \`watchEffect\`; a pre watcher deriving what a post watcher measures in the DOM; and an arrow
  // a setup function hands to another (untracked, \`solid/reactivity\`).
  Runs: `import { defineEmits, onMounted, ref, useTemplateRef, watch, watchEffect } from "unframework";

export interface RunsProps {
  label: string;
}

export default function Runs({ label }: RunsProps) {
  const emit = defineEmits<{
    moved: [low: number, high: number];
    rendered: [count: number];
    saved: [text: string];
  }>();

  const low = ref(0);
  const high = ref(10);
  const query = ref("");
  const results = ref<string[]>([]);
  const notes = ref<string[]>([]);
  const list = useTemplateRef<HTMLUListElement>();

  watch([low, high], ([a, b]) => {
    emit("moved", a, b);
  });

  watch(query, (value) => {
    results.value = value === "" ? [] : [value, \`\${value}!\`];
  });

  watch(
    query,
    () => {
      emit("rendered", list.value?.childElementCount ?? -1);
    },
    { flush: "post" },
  );

  watchEffect(async () => {
    const text = \`\${label} \${query.value}\`;
    await Promise.resolve();
    emit("saved", text);
  });

  onMounted(() => {
    void start();
  });

  async function start() {
    await Promise.resolve();
    low.value = 1;
    high.value = 11;
  }

  function later() {
    setTimeout(() => {
      low.value += 1;
      high.value += 1;
    }, 0);
  }

  function chained() {
    void Promise.resolve(5).then((step) => {
      low.value += step;
      high.value += step;
      emit("saved", \`\${label} \${low.value}\`);
    });
  }

  function update(change: (entries: string[]) => string[]) {
    notes.value = change(notes.value);
  }

  function note() {
    update((entries) => [...entries, \`\${label} \${query.value}\`]);
  }

  async function save() {
    const before = low.value;
    low.value = before + 1;
    const next = high.value + 1;
    high.value = next;
    await Promise.resolve();
    low.value = next;
    high.value = next + before;
  }

  return (
    <section aria-label="Runs">
      <p role="status">
        {low.value}-{high.value}
      </p>
      <ul ref={list}>
        {results.value.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button type="button" onClick={() => (query.value = "a")}>
        Search
      </button>
      <button type="button" onClick={later}>
        Later
      </button>
      <button type="button" onClick={chained}>
        Chained
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <button type="button" onClick={note}>
        Note {notes.value.length}
      </button>
    </section>
  );
}
`,
  // Runs that cross blocks (an \`await\` assigned, a \`try\` and its \`catch\`, a guard, a local
  // arrow called twice), which the scheduler coalesces as any other; callbacks
  // \`solid/reactivity\` reads as tracked (a continuation reading in \`filter\`'s callback, an
  // arrow kept in a variable); and \`onUnmounted\` hooks that run after every cleanup, in order.
  AsyncRuns: `import { defineEmits, onUnmounted, ref, watch, watchEffect } from "unframework";

export default function AsyncRuns() {
  const emit = defineEmits<{
    pair: [low: number, high: number];
    gone: [what: string];
    stopped: [low: number];
  }>();

  const low = ref(0);
  const high = ref(0);
  const limit = ref(3);
  const items = ref<number[]>([]);
  let stop: (() => void) | undefined = undefined;

  onUnmounted(() => {
    emit("gone", "first");
  });

  watch([low, high], ([a, b]) => {
    emit("pair", a, b);
  });

  watch(
    limit,
    (value, previous, onCleanup) => {
      onCleanup(() => emit("gone", \`watch \${value}\`));
    },
    { immediate: true },
  );

  watchEffect((onCleanup) => {
    const value = limit.value;
    onCleanup(() => emit("gone", \`effect \${value}\`));
  });

  async function fetched() {
    low.value = 1;
    high.value = await Promise.resolve(10);
    low.value = 2;
  }

  async function tried(fail: boolean) {
    low.value = 3;
    try {
      const value = await (fail ? Promise.reject(new Error("no")) : Promise.resolve(30));
      high.value = value;
    } catch {
      high.value = -1;
    }
    low.value = 4;
  }

  async function guarded(skip: boolean) {
    low.value = 5;
    if (skip) {
      high.value = 50;
      return;
    }
    high.value = 51;
    await Promise.resolve();
    low.value = 6;
  }

  async function twice() {
    const bump = () => {
      low.value += 1;
    };
    bump();
    bump();
    await Promise.resolve();
    bump();
    high.value += 1;
  }

  function filtered() {
    void Promise.resolve([1, 2, 3, 4, 5]).then((list) => {
      items.value = list.filter((value) => value < limit.value);
      high.value = items.value.length;
    });
  }

  function arm() {
    stop = () => {
      emit("stopped", low.value);
    };
  }

  function halt() {
    stop?.();
    stop = undefined;
  }

  onUnmounted(() => {
    emit("gone", "last");
  });

  return (
    <section aria-label="Async runs">
      <p role="status">
        {low.value}/{high.value}
      </p>
      <button type="button" onClick={fetched}>
        Fetched
      </button>
      <button type="button" onClick={() => tried(false)}>
        Tried
      </button>
      <button type="button" onClick={() => tried(true)}>
        Failed
      </button>
      <button type="button" onClick={() => guarded(true)}>
        Skipped
      </button>
      <button type="button" onClick={() => guarded(false)}>
        Guarded
      </button>
      <button type="button" onClick={twice}>
        Twice
      </button>
      <button type="button" onClick={filtered}>
        Filtered
      </button>
      <button type="button" onClick={arm}>
        Arm
      </button>
      <button type="button" onClick={halt}>
        Halt
      </button>
    </section>
  );
}
`,
  // The run shapes a lexical \`batch\` could not hold, which the watchers' scheduler coalesces as
  // Vue's does (ADR-0048): two awaited writes in one function, a guard before an awaited call of
  // a function that writes first, an \`await\` that may not run (\`??\`), a throw after a write in
  // a \`try\`, a callback parameter and an object's arrows called after an \`await\`, a \`catch\`
  // that returns, a validate-then-save guard, and a statement with two \`await\`s.
  Coalesced: `import { defineEmits, ref, watch } from "unframework";

export default function Coalesced() {
  const emit = defineEmits<{
    state: [step: string, count: number, busy: boolean];
    saved: [name: string];
  }>();

  const step = ref("idle");
  const count = ref(0);
  const busy = ref(false);
  const name = ref("");
  const input = ref("x");
  const cached = ref<number[] | null>(null);

  watch([step, count, busy], ([nextStep, nextCount, nextBusy]) => {
    emit("state", nextStep, nextCount, nextBusy);
  });

  function parse(text: string): number {
    const value = Number(text);
    if (Number.isNaN(value)) throw new Error("Not a number");
    return value;
  }

  async function persist(value: string) {
    busy.value = true;
    await Promise.resolve(value);
    busy.value = false;
  }

  async function withBusy(task: () => void) {
    busy.value = true;
    await Promise.resolve();
    task();
    busy.value = false;
  }

  async function load() {
    step.value = "user";
    count.value = await Promise.resolve(1);
    step.value = "posts";
    count.value = await Promise.resolve(2);
    step.value = "done";
  }

  async function save() {
    step.value = "";
    if (!name.value) return;
    await persist(name.value);
    emit("saved", name.value);
  }

  async function submit() {
    step.value = "";
    const payload = name.value.trim();
    await persist(payload);
    emit("saved", payload);
  }

  async function cachedLoad() {
    busy.value = true;
    const data = cached.value ?? (await Promise.resolve([1, 2, 3]));
    cached.value = data;
    count.value = data.length;
    busy.value = false;
  }

  async function checked() {
    try {
      step.value = "checking";
      count.value = parse(input.value);
      await Promise.resolve();
      step.value = "checked";
    } catch {
      step.value = "invalid";
    }
  }

  function busyLoad() {
    void withBusy(() => {
      count.value = 7;
    });
  }

  async function notify(loud: boolean) {
    const handlers = {
      loud: (text: string) => {
        step.value = text.toUpperCase();
      },
      quiet: (text: string) => {
        step.value = text;
      },
    };
    await Promise.resolve();
    (loud ? handlers.loud : handlers.quiet)("done");
    count.value += 1;
  }

  async function report(fail: boolean): Promise<boolean> {
    busy.value = true;
    try {
      count.value = await (fail ? Promise.reject(new Error("no")) : Promise.resolve(3));
    } catch (caught) {
      step.value = String(caught);
      busy.value = false;
      return false;
    }
    busy.value = false;
    emit("saved", String(count.value));
    return true;
  }

  async function validate() {
    step.value = "";
    if (!name.value) {
      step.value = "Name is required";
      return;
    }
    const payload = name.value;
    busy.value = true;
    await Promise.resolve(payload);
    busy.value = false;
    emit("saved", payload);
  }

  async function sum() {
    step.value = "summing";
    count.value = (await Promise.resolve(1)) + (await Promise.resolve(2));
    step.value = "summed";
  }

  return (
    <section aria-label="Coalesced">
      <p role="status">
        {step.value} {count.value} {busy.value ? "busy" : "idle"}
      </p>
      <button type="button" onClick={load}>
        Load
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <button type="button" onClick={submit}>
        Submit
      </button>
      <button type="button" onClick={() => (name.value = "Ada")}>
        Name
      </button>
      <button type="button" onClick={cachedLoad}>
        Cached
      </button>
      <button type="button" onClick={() => (count.value = 0)}>
        Clear
      </button>
      <button type="button" onClick={checked}>
        Check
      </button>
      <button type="button" onClick={() => (input.value = "5")}>
        Fix
      </button>
      <button type="button" onClick={busyLoad}>
        Busy
      </button>
      <button type="button" onClick={() => notify(true)}>
        Loud
      </button>
      <button type="button" onClick={() => notify(false)}>
        Quiet
      </button>
      <button type="button" onClick={() => report(false)}>
        Report
      </button>
      <button type="button" onClick={() => report(true)}>
        Fail
      </button>
      <button type="button" onClick={validate}>
        Validate
      </button>
      <button type="button" onClick={sum}>
        Sum
      </button>
    </section>
  );
}
`,
  // Reads a condition narrows (\`BindingReference.narrowed\`, src/asserted.ts), which Solid's
  // calls and a prop's property in a closure would lose: a state read whole and through a member
  // path, after a test and a guard clause, in a derived value, a watcher, a template expression
  // and a \`when\` (whose arrow's parameter TypeScript narrows itself), and a destructured prop
  // read in a timer's callback after a guard. L4 checks every assertion it needs.
  // A compound write's target a condition narrows (ADR-0046): its operator reads it, through a
  // call TypeScript never narrows, so the read is asserted; a plain write, \`??=\`, and a target
  // that cannot be absent are not.
  NarrowedWrites: `import { ref } from "unframework";

export default function NarrowedWrites() {
  const count = ref<number | null>(null);
  const label = ref<string | undefined>(undefined);
  const total = ref(0);

  function bump(step: number) {
    if (count.value !== null) count.value += step;
    if (count.value) count.value++;
    if (label.value !== undefined) label.value += "!";
    total.value += step;
  }

  function restart() {
    count.value = 0;
    count.value -= 1;
  }

  function reset() {
    count.value ??= 0;
    count.value = null;
  }

  return (
    <div>
      <p>
        {count.value ?? "none"} {label.value ?? ""} {total.value}
      </p>
      <button type="button" onClick={() => bump(2)}>
        Bump
      </button>
      <button type="button" onClick={restart}>
        Restart
      </button>
      <button type="button" onClick={reset}>
        Reset
      </button>
    </div>
  );
}
`,
  NarrowedReads: `import { computed, defineEmits, ref, watch } from "unframework";

interface Member {
  id: number;
  name: string;
}

interface Draft {
  email?: string;
  tags: string[] | null;
}

export interface NarrowedReadsProps {
  owner?: Member;
  members: Member[];
}

export default function NarrowedReads({ owner, members }: NarrowedReadsProps) {
  const emit = defineEmits<{
    select: [member: Member];
    removed: [name: string];
    submitted: [email: string];
    tagged: [count: number];
    owned: [name: string];
  }>();
  const selected = ref<Member | null>(null);
  const draft = ref<Draft>({ tags: null });
  const greeting = computed(() => (owner ? \`Hello \${owner.name}\` : "Hello"));
  const chosen = computed(() => (selected.value ? selected.value.name : "none"));

  function pick(member: Member) {
    selected.value = { ...member };
  }

  function invite() {
    if (selected.value) emit("select", selected.value);
  }

  function remove() {
    if (!selected.value) return;
    const member = selected.value;
    selected.value = null;
    emit("removed", member.name);
  }

  function submit() {
    if (!draft.value.email) return;
    emit("submitted", draft.value.email);
  }

  function tag() {
    if (draft.value.tags) {
      draft.value = { ...draft.value, tags: [...draft.value.tags, "team"] };
    } else {
      draft.value = { ...draft.value, tags: ["team"] };
    }
    if (draft.value.tags) emit("tagged", draft.value.tags.length);
  }

  function later() {
    if (!owner) return;
    setTimeout(() => {
      emit("owned", owner.name);
    }, 0);
  }

  watch(selected, () => {
    if (selected.value !== null) emit("select", selected.value);
  });

  return (
    <div>
      <p>
        {greeting.value} {chosen.value}
      </p>
      {selected.value !== null ? <p title={selected.value.name}>{selected.value.name}</p> : null}
      <p>{draft.value.email ? draft.value.email.trim() : "no email"}</p>
      {members.map((member) => (
        <button
          key={member.id}
          type="button"
          aria-pressed={selected.value !== null && selected.value.id === member.id}
          onClick={() => pick(member)}
        >
          {member.name}
        </button>
      ))}
      {owner && (
        <button type="button" onClick={() => emit("owned", owner.name)}>
          {owner.name}
        </button>
      )}
      <button type="button" onClick={invite}>
        Invite
      </button>
      <button type="button" onClick={remove}>
        Remove
      </button>
      <button type="button" onClick={() => (draft.value = { ...draft.value, email: " ada@example.com " })}>
        Email
      </button>
      <button type="button" onClick={submit}>
        Send
      </button>
      <button type="button" onClick={tag}>
        Tag
      </button>
      <button type="button" onClick={later}>
        Later
      </button>
    </div>
  );
}
`,
  // Branches whose tests narrow nothing, read as everywhere else (a comparison, a value whose
  // type has no union), beside one a literal union narrows: L4 checks the plain reads.
  PlainBranches: `import { computed, ref } from "unframework";

type Tone = "info" | "warning";

interface Member {
  name: string;
}

export interface PlainBranchesProps {
  count: number;
  tags: string[];
  tone: Tone;
  member: Member;
}

export default function PlainBranches({ count, tags, tone, member }: PlainBranchesProps) {
  const results = ref<string[]>([]);
  const total = computed(() => results.value.length + count);
  return (
    <div>
      {count > 2 ? <p>{count.toFixed(1)} items</p> : null}
      {tags.length === 0 ? (
        <p>No tags</p>
      ) : (
        <ul>
          {tags.map((tag) => (
            <li key={tag}>{tag.toUpperCase()}</li>
          ))}
        </ul>
      )}
      {member.name === "Ada" ? <p>{member.name.trim()}</p> : null}
      {tone === "info" ? <p>{tone.toUpperCase()}</p> : null}
      {results.value.length > 0 ? <p>{results.value.join(", ")}</p> : <p>None</p>}
      {total.value > 2 ? <p>{total.value.toFixed(0)}</p> : null}
    </div>
  );
}
`,
  // Branches narrowed on state, whose \`when\` reads each signal once, and a handler inside a
  // narrowed branch, which reads the branch's accessor.
  NarrowedState: `import { defineEmits, ref } from "unframework";

interface User {
  name: string;
}

export interface NarrowedStateProps {
  member?: User;
}

export default function NarrowedState({ member }: NarrowedStateProps) {
  const emit = defineEmits<{ picked: [name: string] }>();
  const user = ref<User | null>(null);
  const draft = ref<string | null>(null);

  function pick(name: string) {
    user.value = { name };
    emit("picked", name);
  }

  return (
    <div>
      {user.value !== null ? <p>{user.value.name}</p> : <p>Nobody</p>}
      {draft.value !== null && <p>{draft.value.toUpperCase()}</p>}
      {member && (
        <button type="button" onClick={() => pick(member.name)}>
          {member.name}
        </button>
      )}
      <button type="button" onClick={() => (draft.value = "x")}>
        Draft
      </button>
    </div>
  );
}
`,
  // A keyed branch (its expressions narrow its value further) gives plain names, which an
  // interpolated conditional prints as \`<Show>\` (\`solid/prefer-show\`).
  KeyedNames: `export default function KeyedNames({ nick, user }: { nick?: string; user?: { name?: string } }) {
  return (
    <div>
      {nick && <p>{nick.length > 2 ? nick : "-"}</p>}
      {user && <p title={user.name ? user.name.trim() : "anon"}>{user.name ?? "anon"}</p>}
    </div>
  );
}
`,
};
