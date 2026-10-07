// What this target emits for M1's constructs, written by hand in the emitter's shapes (kept in
// step with it): destructured props with defaults, ternary chains with `null`,
// keyed `.map`, `className` through an inline `cx`, a style object (`as CSSProperties` for a
// custom property), React's attribute names and number-typed attributes, and an SVG `<title>` of
// several parts as one template literal. The same three components on every target: a badge
// (props with defaults, a conditional chain, class and style bindings, bound attributes, SVG), a
// list (nested keyed lists, conditionals inside and around them, a root fragment) and a card (the
// `props` form, a typed spread written out key by key, a static style).
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
        <title>{\`\${label}: \${count ?? ""}\`}</title>
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

// What this target emits for M2's setup, events and listeners (ADR-0046 to ADR-0049), one file
// per fixture of test/setup.test.ts, which pins the same text as the emitter's output: state
// with a mirror ref and its setter, `useMemo` with every dependency and a live getter, template
// refs and setup `let`s as refs, ids, hoisted constants and functions, the events' interface and
// props (renamed where a local takes the name, through the props object), prop mirrors for
// deferred code, watchers, `watchEffect` and lifecycle hooks as effects over effect events, the
// writes React Compiler cannot lower written out, synthetic and native listeners with their
// guards, and the `listen`, `useOnce` and `useNextTick` helpers. lint.test.ts pins them on L5,
// toolchain.test.ts on L3 and L4: a rule that rejects one of them would force an emitter change.

/** File name → contents. */
export const M2_SHAPES: Readonly<Record<string, string>> = {
  "Branches.tsx": `import { Fragment, useRef, useState } from "react";

export default function Branches() {
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(editing);

  function toggle() {
    editingRef.current = !editingRef.current;
    setEditing(editingRef.current);
  }

  return (
    <section aria-label="Branches">
      {editing ? (
        <button key="0-0" type="button" onClick={toggle}>
          Save
        </button>
      ) : (
        <button key="0-1" type="button" onClick={toggle}>
          Edit
        </button>
      )}
      {editing ? <p>Editing</p> : <p>Viewing</p>}
      {editing ? (
        <Fragment key="2-0">
          <input name="title" aria-label="Title" />
          <p>Draft</p>
        </Fragment>
      ) : (
        <Fragment key="2-1">
          <input name="search" aria-label="Search" />
          <p>Saved</p>
        </Fragment>
      )}
    </section>
  );
}
`,
  "Loops.tsx": `import { useRef, useState } from "react";

export default function Loops() {
  const [total, setTotal] = useState(0);
  const totalRef = useRef(total);
  const label = useRef<string | undefined>(undefined);

  function run() {
    let count = 0;
    count += 1;
    let note: string | undefined;
    note = note ?? "x";
    label.current = label.current || note;
    for (let index = 0; index < 3; index += 1) {
      setTimeout(() => console.log(index, count), 10);
    }
    for (let other = 0; other < 3; other++) {
      totalRef.current += other;
      setTotal(totalRef.current);
    }
  }

  return (
    <button type="button" onClick={run}>
      {total}
    </button>
  );
}
`,
  "Greeting.tsx": `import { useState } from "react";

export interface GreetingProps {
  name: string;
  sizes: number[];
}

const colors = ["red", "green"];

const palette = { primary: colors[0] ?? "" };

function shout(text: string): string {
  return text.toUpperCase();
}

const whisper = (text: string) => text.toLowerCase();

export default function Greeting({ name, sizes }: GreetingProps) {
  const [greeting] = useState(\`Hello, \${name}\`);
  const [largest] = useState(() => Math.max(...sizes));

  return (
    <p data-color={palette.primary}>
      {shout(greeting)} {whisper(name)} {largest}
    </p>
  );
}
`,
  "Poller.tsx": `import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface PollerProps {
  interval: number;
  label: string;
}

export interface PollerEvents {
  onPinged?: (label: string) => void;
  onDone?: (label: string) => void;
  onChanged?: (count: number) => void;
}

export default function Poller({
  interval,
  label,
  onPinged,
  onDone,
  onChanged,
}: PollerProps & PollerEvents) {
  const labelRef = useRef(label);
  const onPingedRef = useRef(onPinged);
  const onDoneRef = useRef(onDone);
  const onChangedRef = useRef(onChanged);
  useLayoutEffect(() => {
    labelRef.current = label;
    onPingedRef.current = onPinged;
    onDoneRef.current = onDone;
    onChangedRef.current = onChanged;
  });

  const [count] = useState(0);

  const [tick] = useState(() => () => {
    onPingedRef.current?.(labelRef.current);
  });

  async function finish() {
    onChangedRef.current?.(count);
    await Promise.resolve();
    onDoneRef.current?.(labelRef.current);
  }

  const previousCount = useRef(count);
  const onCountChange = useEffectEvent(
    (value: typeof count, previous: typeof count, onCleanup: (cleanup: () => void) => void) => {
      onCleanup(() => onChangedRef.current?.(value + previous));
    },
  );
  useEffect(() => {
    const previous = previousCount.current;
    if (Object.is(previous, count)) return;
    previousCount.current = count;
    const cleanups: (() => void)[] = [];
    onCountChange(count, previous, (cleanup) => void cleanups.push(cleanup));
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [count]);

  const onMount = useEffectEvent(() => {
    setTimeout(tick, interval);
  });
  useEffect(() => {
    onMount();
  }, []);

  return (
    <button type="button" onClick={finish}>
      {count}
    </button>
  );
}
`,
  "Cart.tsx": `import { useMemo, useRef, useState } from "react";

export interface CartProps {
  price: number;
}

export interface CartEvents {
  onCheckout?: (value: number) => void;
}

export default function Cart({ price, onCheckout }: CartProps & CartEvents) {
  const [quantity, setQuantity] = useState(1);
  const quantityRef = useRef(quantity);
  const subtotal = useMemo(() => quantity * price, [quantity, price]);

  function currentSubtotal() {
    return quantityRef.current * price;
  }

  const total = useMemo<number>(() => {
    const rounded = Math.round(subtotal);
    return rounded;
  }, [subtotal]);

  function currentTotal(): number {
    const rounded = Math.round(currentSubtotal());
    return rounded;
  }

  const label = useMemo(() => \`\${quantity} items\`, [quantity]);

  function add() {
    quantityRef.current += 1;
    setQuantity(quantityRef.current);
    onCheckout?.(currentTotal());
  }

  return (
    <div>
      <p>
        {label}: {total}
      </p>
      <button type="button" onClick={add}>
        Add
      </button>
    </div>
  );
}
`,
  "Title.tsx": `import { useEffect, useEffectEvent, useRef, useState } from "react";

export interface TitleProps {
  app: string;
}

export interface TitleEvents {
  onTitle?: (text: string) => void;
}

export default function Title({ app, onTitle }: TitleProps & TitleEvents) {
  const [unread, setUnread] = useState(0);
  const unreadRef = useRef(unread);

  const onUnreadAppChange = useEffectEvent((unreadValue: typeof unread, appValue: typeof app) => {
    onTitle?.(\`\${unreadValue} \${appValue}\`);
  });
  useEffect(() => {
    onUnreadAppChange(unread, app);
  }, [unread, app]);

  const onEffect = useEffectEvent(() => {
    console.log("mounted");
  });
  useEffect(() => {
    onEffect();
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        unreadRef.current++;
        setUnread(unreadRef.current);
      }}
    >
      {unread}
    </button>
  );
}
`,
  "Toggle.tsx": `import type { MouseEvent } from "react";

export interface ToggleProps {
  label: string;
}

export interface ToggleEvents {
  onChange?: (on: boolean, note?: string) => void;
  onUnused?: () => void;
}

export default function Toggle({ label, onChange: onChange_1 }: ToggleProps & ToggleEvents) {
  function onChange(event: MouseEvent) {
    onChange_1?.(event.shiftKey);
  }

  return (
    <button type="button" onClick={onChange}>
      {label}
    </button>
  );
}
`,
  "Listeners.tsx": `import {
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
  useRef,
  useState,
} from "react";

export default function Listeners() {
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  const field = useRef<HTMLInputElement>(null);
  const lastKey = useRef<KeyboardEvent | undefined>(undefined);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  function onKey(event: ReactKeyboardEvent) {
    record(event.key);
  }

  function commit(event: Event | SyntheticEvent) {
    record(event.type);
    console.log(lastKey.current);
  }

  const clickOnce = useOnce();
  const clickOnce_1 = useOnce();
  const changeOnce = useOnce();

  const [wheelListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "wheel", () => record("passive"), { passive: true }),
  );

  const [innerListeners] = useState(
    () => (element: Element | null) => listen(element, "wheel", (event) => event.preventDefault()),
  );

  const [textListeners] = useState(() => (element: HTMLInputElement | null) => {
    field.current = element;
    const stop = listen(element, "change", commit);
    return () => {
      field.current = null;
      stop();
    };
  });

  const [focusListeners] = useState(() => (element: Element | null) => {
    const cleanups = [
      listen(element, "focus", () => record("group focus")),
      listen(element, "focusin", () => record("in")),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });

  const [otherListeners] = useState(() => (element: Element | null) => {
    const cleanups = [
      listen(element, "select", () => record("select")),
      listen(element, "beforeinput", () => record("before")),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });

  const [pListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "mouseenter", () => record("enter"), { capture: true }),
  );

  const [thirdListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "change", (event) => {
        if (!changeOnce(event)) return;
        commit(event);
      }),
  );

  return (
    <section aria-label="Listeners">
      <div
        role="presentation"
        onClickCapture={() => record("capture")}
        onClick={() => record("bubble")}
      >
        <button
          type="button"
          onClick={(event) => {
            record("a");
            if (clickOnce(event)) {
              record(\`once \${event.type}\`);
            }
          }}
        >
          A
        </button>
      </div>
      <div role="group" aria-label="Wheel" ref={wheelListeners}>
        <div role="group" aria-label="Inner" ref={innerListeners}>
          W
        </div>
      </div>
      <input name="text" ref={textListeners} onKeyDown={onKey} onFocus={() => record("focus")} />
      <select name="pick" onChange={commit}>
        <option value="a">A</option>
      </select>
      <div role="group" aria-label="Focus" ref={focusListeners}>
        <input name="other" ref={otherListeners} onKeyUp={onKey} />
      </div>
      <dialog
        onCancel={(event) => {
          if (event.target !== event.currentTarget) return;
          record("cancel");
        }}
        onClose={(event) => {
          if (event.target !== event.currentTarget) return;
          record("close");
        }}
      >
        D
      </dialog>
      <p ref={pListeners}>P</p>
      <button
        type="button"
        onClick={async (event) => {
          if (!clickOnce_1(event)) return;
          await Promise.resolve();
          record("later");
        }}
      >
        B
      </button>
      <input name="third" aria-label="Third" ref={thirdListeners} />
    </section>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}

/** The guard of a listener that runs once per element, as \`{ once: true }\` makes it. */
function useOnce(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = useRef(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}
`,
  "Expander.tsx": `import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

export interface ExpanderEvents {
  onShown?: (rows: number) => void;
}

export default function Expander({ onShown }: ExpanderEvents) {
  const onShownRef = useRef(onShown);
  useLayoutEffect(() => {
    onShownRef.current = onShown;
  });

  const nextTick = useNextTick();
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const rows = useRef<HTMLUListElement>(null);

  async function toggle() {
    openRef.current = !openRef.current;
    setOpen(openRef.current);
    await nextTick();
    onShownRef.current?.(rows.current?.childElementCount ?? 0);
  }

  return (
    <section aria-label="Expander">
      <button type="button" aria-expanded={open} onClick={toggle}>
        Details
      </button>
      {open ? (
        <ul ref={rows}>
          <li>One</li>
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Vue's \`nextTick\` for one component: the promise resolves once React has rendered the writes
 * made before it and run their effects, and \`settled\` says nothing they wrote waits to render;
 * in the task of a click or a key that wrote, as on Vue. It resolves when the component unmounts
 * too.
 */
function useNextTick(settled: () => boolean = () => true): () => Promise<void> {
  const pending = useRef<{ ticket: number; resolve: () => void }[]>([]);
  const tickets = useRef(0);
  const mounted = useRef(false);
  const [rendered, render] = useReducer(
    (last: number, ticket: number) => Math.max(last, ticket),
    0,
  );
  useEffect(() => {
    if (!pending.current.length) return;
    // Once every effect of the commit has run.
    queueMicrotask(() => {
      if (!settled()) {
        // What the component's effects wrote has yet to render, and may end where it was, when
        // React commits nothing: a render of its own makes the next look certain.
        tickets.current += 1;
        render(tickets.current);
        return;
      }
      const due = pending.current.filter(({ ticket }) => ticket <= rendered);
      pending.current = pending.current.filter(({ ticket }) => ticket > rendered);
      for (const { resolve } of due) resolve();
    });
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        const due = pending.current;
        pending.current = [];
        for (const { resolve } of due) resolve();
      });
    };
  }, []);
  return () =>
    new Promise<void>((resolve) => {
      tickets.current += 1;
      const ticket = tickets.current;
      pending.current.push({ ticket, resolve });
      render(ticket);
    });
}
`,
  "Bare.tsx": `export interface BareEvents {
  onPing?: (count: number) => void;
}

export function Bare({ onPing }: BareEvents) {
  return (
    <button type="button" onClick={() => onPing?.(1)}>
      Ping
    </button>
  );
}
`,
  "Panel.tsx": `export interface PanelProps {
  title: string;
}

export interface PanelEvents {
  onClose?: () => void;
}

export function Panel(props: PanelProps & PanelEvents) {
  return (
    <section aria-label={props.title}>
      <button type="button" onClick={() => props.onClose?.()}>
        Close
      </button>
    </section>
  );
}
`,
  "Field.tsx": `import { useEffect, useEffectEvent, useId, useRef } from "react";

export default function Field() {
  const input = useRef<HTMLInputElement>(null);
  const inputId = \`uf-id-\${useId()}\`;
  const timer = useRef<number | undefined>(undefined);
  const ticks = useRef(0);
  const last = useRef<string>("");

  const onMount = useEffectEvent(() => {
    input.current?.focus();
    timer.current = window.setInterval(() => {
      ticks.current += 1;
      last.current = String(ticks.current);
    }, 1000);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => {
    window.clearInterval(timer.current);
    console.log(last.current);
  });
  useEffect(() => () => onUnmount(), []);

  return (
    <div>
      <label htmlFor={inputId}>Name</label>
      <input id={inputId} ref={input} />
    </div>
  );
}
`,
  "Stepper.tsx": `import { useRef, useState } from "react";

export default function Stepper() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  const [items] = useState(["a", "b"]);
  const [doubled] = useState(() => [1, 2].map((n) => n * 2));
  const [label, setLabel] = useState<string>();
  const labelRef = useRef(label);

  function bump(on: boolean) {
    if (on) {
      countRef.current = 1;
      setCount(countRef.current);
    } else {
      countRef.current++;
      setCount(countRef.current);
    }
    for (const item of items) {
      labelRef.current = labelRef.current ?? item;
      setLabel(labelRef.current);
    }
    countRef.current **= 2;
    setCount(countRef.current);
  }

  return (
    <div>
      <p>
        {count} {items.length} {doubled.length} {label}
      </p>
      <button type="button" onClick={() => bump(true)}>
        Bump
      </button>
      <button
        type="button"
        onClick={() => {
          countRef.current = 0;
          setCount(countRef.current);
        }}
      >
        Reset
      </button>
    </div>
  );
}
`,
  "Labels.tsx": `import { useRef, useState } from "react";

export interface LabelsEvents {
  onSaid?: (text: string) => void;
}

export default function Labels({ onSaid }: LabelsEvents) {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  function label(): string {
    return \`\${count} items\`;
  }

  function currentLabel(): string {
    return \`\${countRef.current} items\`;
  }

  function add() {
    countRef.current++;
    setCount(countRef.current);
    onSaid?.(currentLabel());
  }

  return (
    <button type="button" onClick={add}>
      {label()}
    </button>
  );
}
`,
  "Range.tsx": `import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface RangeProps {
  unit: string;
}

export interface RangeEvents {
  onMoved?: (low: number, high: number) => void;
  onSpanned?: (span: number) => void;
  onUnitSet?: (unit: string, previous?: string) => void;
}

export default function Range({ unit, onMoved, onSpanned, onUnitSet }: RangeProps & RangeEvents) {
  const onSpannedRef = useRef(onSpanned);
  useLayoutEffect(() => {
    onSpannedRef.current = onSpanned;
  });

  const [low, setLow] = useState(0);
  const lowRef = useRef(low);
  const [high] = useState(10);

  const previousLowHigh = useRef<[typeof low, typeof high]>([low, high]);
  const onLowHighChange = useEffectEvent(
    (
      [from, to]: [typeof low, typeof high],
      previous: [typeof low, typeof high],
      onCleanup: (cleanup: () => void) => void,
    ) => {
      onMoved?.(from, to);
      onCleanup(() => onSpannedRef.current?.(previous.length));
    },
  );
  useEffect(() => {
    const previous = previousLowHigh.current;
    if (Object.is(previous[0], low) && Object.is(previous[1], high)) return;
    previousLowHigh.current = [low, high];
    const cleanups: (() => void)[] = [];
    onLowHighChange([low, high], previous, (cleanup) => void cleanups.push(cleanup));
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [low, high]);

  const watchedSpan = useMemo(() => high - low, [high, low]);
  const previousSpan = useRef(watchedSpan);
  const onSpanChange = useEffectEvent((span: number) => {
    onSpannedRef.current?.(span);
  });
  useEffect(() => {
    const previous = previousSpan.current;
    if (Object.is(previous, watchedSpan)) return;
    previousSpan.current = watchedSpan;
    onSpanChange(watchedSpan);
  }, [watchedSpan]);

  const previousUnit = useRef<typeof unit | undefined>(undefined);
  const onUnitChange = useEffectEvent((value: typeof unit, previous: typeof unit | undefined) => {
    onUnitSet?.(value, previous);
  });
  useEffect(() => {
    const previous = previousUnit.current;
    previousUnit.current = unit;
    onUnitChange(unit, previous);
  }, [unit]);

  const onLowUnitChange = useEffectEvent(([from]: [typeof low, typeof unit]) => {
    onSpannedRef.current?.(from);
  });
  useEffect(() => {
    onLowUnitChange([low, unit]);
  }, [low, unit]);

  const previousLow = useRef(low);
  const onLowChange = useEffectEvent(() => {
    onSpannedRef.current?.(0);
  });
  useEffect(() => {
    const previous = previousLow.current;
    if (Object.is(previous, low)) return;
    previousLow.current = low;
    onLowChange();
  }, [low]);

  return (
    <button
      type="button"
      onClick={() => {
        lowRef.current += 1;
        setLow(lowRef.current);
      }}
    >
      {low} to {high} {unit}
    </button>
  );
}
`,
  "Ready.tsx": `import { useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState } from "react";

export interface ReadyEvents {
  onShown?: (text: string) => void;
  onMeasured?: (text: string) => void;
}

export default function Ready({ onShown, onMeasured }: ReadyEvents) {
  const onShownRef = useRef(onShown);
  const onMeasuredRef = useRef(onMeasured);
  useLayoutEffect(() => {
    onShownRef.current = onShown;
    onMeasuredRef.current = onMeasured;
  });

  const [label, setLabel] = useState("Loading");
  const labelRef = useRef(label);
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  const [doubled, setDoubled] = useState(0);
  const doubledRef = useRef(doubled);
  const nextTick = useNextTick(
    () => Object.is(labelRef.current, label) && Object.is(doubledRef.current, doubled),
  );
  const out = useRef<HTMLOutputElement>(null);
  const twice = useRef<HTMLParagraphElement>(null);

  const previousCount = useRef(count);
  const onCountChange = useEffectEvent((value: typeof count) => {
    doubledRef.current = value * 2;
    setDoubled(doubledRef.current);
  });
  useEffect(() => {
    const previous = previousCount.current;
    if (Object.is(previous, count)) return;
    previousCount.current = count;
    onCountChange(count);
  }, [count]);

  const onMount = useEffectEvent(async () => {
    labelRef.current = "Ready";
    setLabel(labelRef.current);
    await nextTick();
    onShownRef.current?.(out.current?.textContent ?? "");
  });
  useEffect(() => {
    onMount();
  }, []);

  async function bump() {
    countRef.current += 1;
    setCount(countRef.current);
    await nextTick();
    onMeasuredRef.current?.(twice.current?.textContent ?? "");
  }

  return (
    <div>
      <output ref={out}>{label}</output>
      <button type="button" onClick={bump}>
        Bump
      </button>
      <p ref={twice}>{doubled}</p>
    </div>
  );
}

/**
 * Vue's \`nextTick\` for one component: the promise resolves once React has rendered the writes
 * made before it and run their effects, and \`settled\` says nothing they wrote waits to render;
 * in the task of a click or a key that wrote, as on Vue. It resolves when the component unmounts
 * too.
 */
function useNextTick(settled: () => boolean = () => true): () => Promise<void> {
  const pending = useRef<{ ticket: number; resolve: () => void }[]>([]);
  const tickets = useRef(0);
  const mounted = useRef(false);
  const [rendered, render] = useReducer(
    (last: number, ticket: number) => Math.max(last, ticket),
    0,
  );
  useEffect(() => {
    if (!pending.current.length) return;
    // Once every effect of the commit has run.
    queueMicrotask(() => {
      if (!settled()) {
        // What the component's effects wrote has yet to render, and may end where it was, when
        // React commits nothing: a render of its own makes the next look certain.
        tickets.current += 1;
        render(tickets.current);
        return;
      }
      const due = pending.current.filter(({ ticket }) => ticket <= rendered);
      pending.current = pending.current.filter(({ ticket }) => ticket > rendered);
      for (const { resolve } of due) resolve();
    });
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        const due = pending.current;
        pending.current = [];
        for (const { resolve } of due) resolve();
      });
    };
  }, []);
  return () =>
    new Promise<void>((resolve) => {
      tickets.current += 1;
      const ticket = tickets.current;
      pending.current.push({ ticket, resolve });
      render(ticket);
    });
}
`,
  "Focus.tsx": `import { useRef, useState } from "react";

export interface FocusEvents {
  onStarted?: (count: number) => void;
}

export default function Focus({ onStarted }: FocusEvents) {
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(focused);
  const [n, setN] = useState(0);
  const nRef = useRef(n);
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  const clickOnce = useOnce();
  const clickOnce_1 = useOnce();
  const changeOnce = useOnce();

  const [inputListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "change", (event) => {
        focusedRef.current = (event.currentTarget as HTMLInputElement).value === "";
        setFocused(focusedRef.current);
        if (changeOnce(event)) {
          nRef.current = 2;
          setN(nRef.current);
        }
      }),
  );

  return (
    <div>
      <button
        type="button"
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return;
          focusedRef.current = true;
          setFocused(focusedRef.current);
        }}
        onBlur={(event) => {
          if (event.target !== event.currentTarget) return;
          nRef.current++;
          setN(nRef.current);
        }}
      >
        Menu
      </button>
      <button
        type="button"
        onClick={(event) => {
          if (!clickOnce(event)) return;
          nRef.current = 1;
          setN(nRef.current);
        }}
      >
        Once
      </button>
      <button
        type="button"
        onClick={(event) => {
          countRef.current++;
          setCount(countRef.current);
          if (clickOnce_1(event)) {
            onStarted?.(countRef.current);
          }
        }}
      >
        Go
      </button>
      <input ref={inputListeners} />
      <p>
        {focused ? "yes" : "no"} {n} {count}
      </p>
    </div>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}

/** The guard of a listener that runs once per element, as \`{ once: true }\` makes it. */
function useOnce(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = useRef(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}
`,
  "Fields.tsx": `import { useLayoutEffect, useRef, useState } from "react";

export interface FieldsProps {
  label: string;
}

export interface FieldsEvents {
  onFirst?: (value: string) => void;
  onTyped?: (label: string, value: string) => void;
}

const rows = ["a", "b"];

export default function Fields({ label, onFirst, onTyped: onTyped_1 }: FieldsProps & FieldsEvents) {
  const labelRef = useRef(label);
  const onFirstRef = useRef(onFirst);
  const onTypedRef = useRef(onTyped_1);
  useLayoutEffect(() => {
    labelRef.current = label;
    onFirstRef.current = onFirst;
    onTypedRef.current = onTyped_1;
  });

  const [name, setName] = useState("");
  const nameRef = useRef(name);
  const field = useRef<HTMLInputElement>(null);

  function onTyped(event: Event) {
    onTypedRef.current?.(labelRef.current, (event.currentTarget as HTMLInputElement).value);
  }

  const changeOnce = useOnce();

  const [fullNameListeners] = useState(() => (element: Element | null) => {
    const cleanups = [
      listen(element, "change", (event) => {
        nameRef.current = (event.currentTarget as HTMLInputElement).value;
        setName(nameRef.current);
        if (changeOnce(event)) {
          onFirstRef.current?.((event.currentTarget as HTMLInputElement).value);
        }
      }),
      listen(element, "beforeinput", onTyped),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });

  const [fieldListeners] = useState(() => (element: HTMLInputElement | null) => {
    field.current = element;
    const cleanups = [
      listen(element, "change", onTyped),
      listen(element, "focusin", () => field.current?.select()),
    ];
    return () => {
      field.current = null;
      for (const cleanup of cleanups) cleanup();
    };
  });

  return (
    <div>
      <input name="full-name" ref={fullNameListeners} />
      <input ref={fieldListeners} />
      <ul>
        {rows.map((row) => (
          <li key={row}>
            <input
              aria-label={row}
              ref={(element) => listen(element, "change", () => onFirstRef.current?.(row))}
            />
          </li>
        ))}
      </ul>
      <p>{name}</p>
    </div>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}

/** The guard of a listener that runs once per element, as \`{ once: true }\` makes it. */
function useOnce(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = useRef(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}
`,
  "Choices.tsx": `import { type MouseEvent, useRef, useState } from "react";

function hold(event: MouseEvent) {
  event.preventDefault();
}

export default function Choices() {
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  const [fieldsListeners] = useState(() => (element: Element | null) => {
    const cleanups = [
      listen(element, "focusin", () => record("group focusin")),
      listen(element, "focusout", () => record("group focusout")),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });

  const [nameListeners] = useState(() => (element: Element | null) => {
    const cleanups = [
      listen(element, "focus", () => record("input focus")),
      listen(element, "blur", () => record("input blur")),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });

  const [newsListeners] = useState(
    () => (element: Element | null) => listen(element, "change", () => record("change")),
  );

  const [heldListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "change", (event) =>
        record(\`change \${(event.currentTarget as HTMLInputElement).checked}\`),
      ),
  );

  return (
    <div role="group" aria-label="Fields" ref={fieldsListeners}>
      <label>
        Name
        <input name="name" ref={nameListeners} />
      </label>
      <label>
        <input
          type="checkbox"
          name="news"
          onClick={() => record("click")}
          onInput={() => record("input")}
          ref={newsListeners}
        />
        News
      </label>
      <label>
        <input type="checkbox" name="held" onClick={hold} ref={heldListeners} />
        Held
      </label>
      <p>{log.join(", ")}</p>
    </div>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}
`,
  "Modes.tsx": `import { Fragment, useRef, useState } from "react";

export default function Modes() {
  const [mode, setMode] = useState("a");
  const modeRef = useRef(mode);
  const [flag, setFlag] = useState(true);
  const flagRef = useRef(flag);
  const [other] = useState(false);

  function toB() {
    modeRef.current = "b";
    setMode(modeRef.current);
  }

  function toC() {
    flagRef.current = false;
    setFlag(flagRef.current);
  }

  function toA() {
    modeRef.current = "a";
    setMode(modeRef.current);
    flagRef.current = true;
    setFlag(flagRef.current);
  }

  return (
    <section aria-label="Modes">
      {mode === "a" ? (
        <button key="0-0" type="button" onClick={toB}>
          A
        </button>
      ) : flag ? (
        <button key="0-1.0" type="button" onClick={toC}>
          B
        </button>
      ) : (
        <button key="0-1.1" type="button" onClick={toA}>
          C
        </button>
      )}
      {other ? (
        <Fragment key="1-0">
          <span>One</span>
          {flag ? (
            <button key={0} type="button" onClick={toC}>
              D
            </button>
          ) : (
            <button key={1} type="button" onClick={toA}>
              E
            </button>
          )}
        </Fragment>
      ) : (
        <Fragment key="1-1">
          <b>Two</b>
          {flag ? (
            <button key={0} type="button" onClick={toC}>
              F
            </button>
          ) : (
            <button key={1} type="button" onClick={toA}>
              G
            </button>
          )}
        </Fragment>
      )}
    </section>
  );
}
`,
  "Level.tsx": `import { useEffect, useEffectEvent, useRef, useState } from "react";

export interface LevelProps {
  unit: string;
}

export interface LevelEvents {
  onReport?: (text: string) => void;
}

export default function Level({ unit, onReport }: LevelProps & LevelEvents) {
  const [level, setLevel] = useState(1);
  const levelRef = useRef(level);
  const [step, setStep] = useState(1);
  const stepRef = useRef(step);

  function describe(): string {
    const text = \`\${levelRef.current} \${unit}\`;
    return text;
  }

  const onStepUnitLevelChange = useEffectEvent(
    (stepValue: typeof step, _unit: typeof unit, _level: typeof level) => {
      onReport?.(\`\${describe()} by \${stepValue}\`);
    },
  );
  useEffect(() => {
    onStepUnitLevelChange(step, unit, level);
  }, [step, unit, level]);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          levelRef.current++;
          setLevel(levelRef.current);
        }}
      >
        Up
      </button>
      <button
        type="button"
        onClick={() => {
          stepRef.current = 2;
          setStep(stepRef.current);
        }}
      >
        Step
      </button>
    </div>
  );
}
`,
  "Shortcuts.tsx": `import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface ShortcutsEvents {
  onShortcut?: (key: string, count: number) => void;
}

export default function Shortcuts({ onShortcut }: ShortcutsEvents) {
  const onShortcutRef = useRef(onShortcut);
  useLayoutEffect(() => {
    onShortcutRef.current = onShortcut;
  });

  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(enabled);
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  const [onKey] = useState(() => (event: KeyboardEvent) => {
    if (enabledRef.current) {
      countRef.current += 1;
      setCount(countRef.current);
      onShortcutRef.current?.(event.key, countRef.current);
    }
  });

  const [onEscape] = useState(() => (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      enabledRef.current = false;
      setEnabled(enabledRef.current);
    }
  });

  const previousEnabled = useRef(enabled);
  const onEnabledChange = useEffectEvent((on: typeof enabled) => {
    if (on) document.addEventListener("keydown", onKey);
    else document.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    const previous = previousEnabled.current;
    if (Object.is(previous, enabled)) return;
    previousEnabled.current = enabled;
    onEnabledChange(enabled);
  }, [enabled]);

  const onMount = useEffectEvent(() => {
    document.addEventListener("keyup", onEscape);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => {
    document.removeEventListener("keyup", onEscape);
    document.removeEventListener("keydown", onKey);
  });
  useEffect(() => () => onUnmount(), []);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          enabledRef.current = !enabledRef.current;
          setEnabled(enabledRef.current);
        }}
      >
        Toggle
      </button>
      <p>Used: {count}</p>
    </div>
  );
}
`,
  "Late.tsx": `import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface LateEvents {
  onShortcut?: (key: string, count: number) => void;
}

export default function Late({ onShortcut }: LateEvents) {
  const onShortcutRef = useRef(onShortcut);
  useLayoutEffect(() => {
    onShortcutRef.current = onShortcut;
  });

  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  const [onKey] = useState(() => (event: KeyboardEvent) => {
    countRef.current += 1;
    setCount(countRef.current);
    onShortcutRef.current?.(event.key, countRef.current);
  });

  const onMount = useEffectEvent(() => {
    document.addEventListener("keydown", onKey);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => {
    document.removeEventListener("keydown", onKey);
  });
  useEffect(() => () => onUnmount(), []);

  return <p>Used: {count}</p>;
}
`,
  "Tally.tsx": `import { useState } from "react";

export interface TallyEvents {
  onCounted?: (done: number, total: number, last: number) => void;
}

export default function Tally({ onCounted }: TallyEvents) {
  const [rows] = useState<boolean[]>([true, false, true]);

  function count() {
    let done = 0;
    let total = 0;
    let last = 0;
    const marks: number[] = [];
    rows.forEach((row) => row && (done += 1));
    const add = () => (total += 1) - 1;
    rows.forEach(() => {
      marks.push((last += 1) * 2);
      add();
    });
    onCounted?.(done, total, last + marks.length);
  }

  return (
    <button type="button" onClick={count}>
      Count
    </button>
  );
}
`,
  "Counts.tsx": `export interface CountsEvents {
  onCounted?: (values: number[]) => void;
}

export default function Counts({ onCounted }: CountsEvents) {
  function count() {
    let a = 0;
    let b = 10;
    const values: number[] = [];
    const bump = () => {
      void (a += 1);
      values.push(((a += 1) - 1) * 2, (b -= 1) + 1 - 1, (a += 1), values[(a += 1) - 1] ?? 0);
      if ((a += 1) - 1 > 3) b -= 1;
      return (a += 1) - 1 || (b -= 1) + 1;
    };
    for (let i = 0; i < 2; i++) values.push(bump());
    [1, 2].forEach((n) => (n > 1 ? (a += 1) : (b -= 1)));
    onCounted?.([...values, a, b]);
  }

  return (
    <button type="button" onClick={count}>
      Count
    </button>
  );
}
`,
  "Measured.tsx": `import { useEffect, useEffectEvent, useRef, useState } from "react";

export interface MeasuredEvents {
  onRendered?: (count: number) => void;
}

export default function Measured({ onRendered }: MeasuredEvents) {
  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const [results, setResults] = useState<string[]>([]);
  const resultsRef = useRef(results);
  const list = useRef<HTMLUListElement>(null);

  const previousQuery = useRef(query);
  const onQueryChange = useEffectEvent((value: typeof query) => {
    resultsRef.current = value === "" ? [] : [value, \`\${value} docs\`];
    setResults(resultsRef.current);
  });
  useEffect(() => {
    const previous = previousQuery.current;
    if (Object.is(previous, query)) return;
    previousQuery.current = query;
    onQueryChange(query);
  }, [query]);

  const [waits, setWaits] = useState(0);
  const previousQuery_1 = useRef(query);
  const onQueryChange_1 = useEffectEvent(() => {
    onRendered?.(list.current?.childElementCount ?? -1);
  });
  useEffect(() => {
    if (!Object.is(resultsRef.current, results)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousQuery_1.current;
    if (Object.is(previous, query)) return;
    previousQuery_1.current = query;
    onQueryChange_1();
  }, [query, results, waits]);

  return (
    <section aria-label="Measured">
      <button
        type="button"
        onClick={() => {
          queryRef.current = "vue";
          setQuery(queryRef.current);
        }}
      >
        Search
      </button>
      <ul ref={list} aria-label="Results">
        {results.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
    </section>
  );
}
`,
  "PriceTag.tsx": `import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

export interface PriceTagProps {
  /** The unit price, in cents. */
  price: number;
}

function formatCents(cents: number): string {
  return \`EUR \${(cents / 100).toFixed(2)}\`;
}

export default function PriceTag({ price }: PriceTagProps) {
  const [quantity, setQuantity] = useState(1);
  const quantityRef = useRef(quantity);
  const [unit, setUnit] = useState(() => formatCents(price));
  const unitRef = useRef(unit);
  const total = useMemo(() => formatCents(price * quantity), [price, quantity]);
  const [last, setLast] = useState("none");
  const lastRef = useRef(last);

  function describe(): string {
    return \`\${quantity} at \${formatCents(price)}\`;
  }

  function currentDescribe(): string {
    return \`\${quantityRef.current} at \${formatCents(price)}\`;
  }

  const [summary, setSummary] = useState(() => describe());
  const summaryRef = useRef(summary);

  const previousQuantity = useRef(quantity);
  const onQuantityChange = useEffectEvent(() => {
    lastRef.current = currentDescribe();
    setLast(lastRef.current);
  });
  useEffect(() => {
    const previous = previousQuantity.current;
    if (Object.is(previous, quantity)) return;
    previousQuantity.current = quantity;
    onQuantityChange();
  }, [quantity]);

  function add() {
    quantityRef.current++;
    setQuantity(quantityRef.current);
    summaryRef.current = currentDescribe();
    setSummary(summaryRef.current);
  }

  return (
    <section className="price-tag" aria-label="Price">
      <p>Unit: {unit}</p>
      <p role="status">{summary}</p>
      <p>Total: {total}</p>
      <p>Last change: {last}</p>
      <button type="button" onClick={add}>
        Add one
      </button>
      <button
        type="button"
        onClick={() => {
          unitRef.current = formatCents(price * 2);
          setUnit(unitRef.current);
        }}
      >
        Price two
      </button>
    </section>
  );
}
`,
  "RefTypes.tsx": `import { useEffect, useEffectEvent, useRef, useState } from "react";

export default function RefTypes() {
  const panel = useRef<HTMLElement>(null);
  const field = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const note = useRef<HTMLElement>(null);
  const box = useRef<HTMLParagraphElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const name = useRef<HTMLElement>(null);

  const onMount = useEffectEvent(() => {
    panel.current?.focus();
    field.current?.select();
    note.current?.scrollIntoView();
    box.current?.scrollIntoView();
    dot.current?.getBBox();
    name.current?.blur();
  });
  useEffect(() => {
    onMount();
  }, []);

  const [nameListeners] = useState(() => (element: HTMLElement | null) => {
    name.current = element;
    const stop = listen(element, "change", () => name.current?.blur());
    return () => {
      name.current = null;
      stop();
    };
  });

  return (
    <div
      ref={(element) => {
        panel.current = element;
      }}
      role="group"
      aria-label="Actions"
    >
      <input
        ref={(element) => {
          field.current = element;
        }}
        aria-label="Field"
      />
      <section ref={note}>Note</section>
      <p ref={box}>Box</p>
      <svg viewBox="0 0 10 10" role="img" aria-label="Dot">
        <circle ref={dot} cx="5" cy="5" r="4" />
      </svg>
      <input ref={nameListeners} aria-label="Name" />
    </div>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}
`,
  "Memos.tsx": `import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

export interface MemosEvents {
  onSeen?: (text: string) => void;
  onTotal?: (value: number) => void;
}

export default function Memos({ onSeen, onTotal }: MemosEvents) {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  function currentBase() {
    return countRef.current * 2;
  }

  function currentChained() {
    return currentBase() + 1;
  }

  const watched = useMemo(() => count > 3, [count]);
  const effected = useMemo(() => count % 2, [count]);
  const initial = useMemo(() => count - 1, [count]);
  const [start] = useState(initial);
  const labelled = useMemo(() => \`n\${count}\`, [count]);

  function currentLabelled() {
    return \`n\${countRef.current}\`;
  }

  function label() {
    return labelled;
  }

  function currentLabel() {
    return currentLabelled();
  }

  const previousWatched = useRef(watched);
  const onWatchedChange = useEffectEvent((value: typeof watched) => onSeen?.(String(value)));
  useEffect(() => {
    const previous = previousWatched.current;
    if (Object.is(previous, watched)) return;
    previousWatched.current = watched;
    onWatchedChange(watched);
  }, [watched]);

  const onEffectedChange = useEffectEvent((effectedValue: typeof effected) => {
    onTotal?.(effectedValue);
  });
  useEffect(() => {
    onEffectedChange(effected);
  }, [effected]);

  function report() {
    onTotal?.(currentChained() + start);
    onSeen?.(currentLabel());
  }

  return (
    <div>
      <p>
        {count} {label()}
      </p>
      <button
        type="button"
        onClick={() => {
          countRef.current++;
          setCount(countRef.current);
        }}
      >
        Add
      </button>
      <button type="button" onClick={report}>
        Report
      </button>
    </div>
  );
}
`,
  "Merged.tsx": `import { useLayoutEffect, useRef, useState } from "react";

export interface MergedEvents {
  onLog?: (entry: string) => void;
}

export default function Merged({ onLog }: MergedEvents) {
  const onLogRef = useRef(onLog);
  useLayoutEffect(() => {
    onLogRef.current = onLog;
  });

  const [tags] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const labelRef = useRef(label);
  const [ready] = useState(false);

  function record(entry: string) {
    onLogRef.current?.(entry);
  }

  const clickOnce = useOnce();
  const changeOnce = useOnce();
  const clickOnce_1 = useOnce();
  const clickOnce_2 = useOnce();
  const clickOnce_3 = useOnce();
  const clickOnce_4 = useOnce();

  const [nameListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "change", (event) => {
        const value = (event.target as HTMLInputElement).value;
        if (!(value === "" || value === labelRef.current)) {
          labelRef.current = value;
          setLabel(labelRef.current);
        }
        if (changeOnce(event)) {
          const changeListener = (e: typeof event) => {
            record((e.target as HTMLInputElement).value);
          };
          changeListener(event);
        }
      }),
  );

  return (
    <div>
      <button
        type="button"
        onClick={(event) => {
          if (tags.length !== 0) {
            if (ready) {
              record("saved");
            }
          }
          if (clickOnce(event)) {
            record("first save");
          }
        }}
      >
        Save
      </button>
      <input aria-label="Name" ref={nameListeners} />
      <button
        type="button"
        onClick={(event) => {
          const clickListener = async () => {
            record("sync start");
            await new Promise((resolve) => setTimeout(resolve, 10));
            record("sync done");
          };
          void clickListener();
          if (clickOnce_1(event)) {
            record("first sync");
          }
        }}
      >
        Sync
      </button>
      <a
        href="#moved"
        onClick={(event) => {
          if (clickOnce_2(event)) {
            const clickListener = async () => {
              record("first");
              await new Promise((resolve) => setTimeout(resolve, 10));
              record("first done");
            };
            void clickListener();
          }
          event.preventDefault();
          record("held");
        }}
      >
        Move
      </a>
      <button
        type="button"
        onClick={(event) => {
          const clickListener = () => {
            for (const tag of tags) {
              if (tag === "") return;
            }
            const entry = "tagged";
            record(entry);
          };
          clickListener();
          if (clickOnce_3(event)) {
            record(labelRef.current);
          }
        }}
      >
        Tag
      </button>
      <button
        type="button"
        onClick={(event) => {
          const clickListener = () => {
            const navigator = "local";
            record(navigator);
          };
          clickListener();
          if (clickOnce_4(event)) {
            record(navigator.language);
          }
        }}
      >
        Ready
      </button>
    </div>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}

/** The guard of a listener that runs once per element, as \`{ once: true }\` makes it. */
function useOnce(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = useRef(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}
`,
  "Narrowed.tsx": `import { useLayoutEffect, useRef } from "react";

export interface User {
  name: string;
}

export interface NarrowedProps {
  owner?: User;
  value: string | number;
}

export interface NarrowedEvents {
  onPicked?: (name: string) => void;
}

export default function Narrowed({ owner, value, onPicked }: NarrowedProps & NarrowedEvents) {
  const ownerRef = useRef(owner);
  const onPickedRef = useRef(onPicked);
  useLayoutEffect(() => {
    ownerRef.current = owner;
    onPickedRef.current = onPicked;
  });

  function pick(who: User) {
    onPickedRef.current?.(who.name);
  }

  function use(text: string) {
    onPickedRef.current?.(text);
  }

  return (
    <div>
      {owner ? (
        <input aria-label="Owner" ref={(element) => listen(element, "change", () => pick(owner))} />
      ) : null}
      {owner ? (
        <button type="button" onClick={() => pick(owner)}>
          Pick
        </button>
      ) : (
        <p>No owner</p>
      )}
      {typeof value === "string" ? (
        <input aria-label="Value" ref={(element) => listen(element, "change", () => use(value))} />
      ) : null}
      <button
        type="button"
        onClick={() => setTimeout(() => onPickedRef.current?.(ownerRef.current?.name ?? "none"), 1)}
      >
        Later
      </button>
    </div>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}
`,
  "NestKeys.tsx": `import { Fragment, useRef, useState } from "react";

export default function NestKeys() {
  const [mode, setMode] = useState("a");
  const modeRef = useRef(mode);
  const [ready] = useState(true);
  const [more, setMore] = useState(false);
  const moreRef = useRef(more);

  return (
    <div>
      {mode === "a" ? (
        ready ? (
          <button
            key="0-0.0"
            type="button"
            onClick={() => {
              modeRef.current = "b";
              setMode(modeRef.current);
            }}
          >
            A
          </button>
        ) : null
      ) : ready ? (
        <button
          key="0-1.0"
          type="button"
          onClick={() => {
            modeRef.current = "a";
            setMode(modeRef.current);
          }}
        >
          B
        </button>
      ) : null}
      {mode === "a" ? (
        <Fragment key="1-0">
          <span>One</span>
          {ready ? (
            <button
              type="button"
              onClick={() => {
                moreRef.current = !moreRef.current;
                setMore(moreRef.current);
              }}
            >
              C
            </button>
          ) : null}
          {more ? (
            <button
              type="button"
              onClick={() => {
                modeRef.current = "b";
                setMode(modeRef.current);
              }}
            >
              D
            </button>
          ) : null}
        </Fragment>
      ) : (
        <Fragment key="1-1">
          <span>Two</span>
          {ready ? (
            <button
              type="button"
              onClick={() => {
                modeRef.current = "a";
                setMode(modeRef.current);
              }}
            >
              E
            </button>
          ) : null}
        </Fragment>
      )}
    </div>
  );
}
`,
  "Settle.tsx": `import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface SettleEvents {
  onLog?: (entry: string) => void;
}

export default function Settle({ onLog }: SettleEvents) {
  const onLogRef = useRef(onLog);
  useLayoutEffect(() => {
    onLogRef.current = onLog;
  });

  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const [results, setResults] = useState<string[]>([]);
  const resultsRef = useRef(results);
  const list = useRef<HTMLUListElement>(null);

  const previousQuery = useRef(query);
  const onQueryChange = useEffectEvent((value: typeof query) => {
    resultsRef.current = value === "" ? [] : [value, \`\${value} docs\`];
    setResults(resultsRef.current);
  });
  useEffect(() => {
    const previous = previousQuery.current;
    if (Object.is(previous, query)) return;
    previousQuery.current = query;
    onQueryChange(query);
  }, [query]);

  const [waits, setWaits] = useState(0);
  const previousQuery_1 = useRef(query);
  const queryCleanups = useRef<(() => void)[]>([]);
  const onQueryChange_1 = useEffectEvent(
    (value: typeof query, previous: typeof query, onCleanup: (cleanup: () => void) => void) => {
      onLogRef.current?.(\`post \${previous} \${value} \${list.current?.childElementCount ?? -1}\`);
      onCleanup(() => onLogRef.current?.(\`post cleanup \${value}\`));
    },
  );
  useEffect(() => {
    if (!Object.is(resultsRef.current, results)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousQuery_1.current;
    if (Object.is(previous, query)) return;
    previousQuery_1.current = query;
    for (const cleanup of queryCleanups.current.splice(0)) cleanup();
    onQueryChange_1(query, previous, (cleanup) => void queryCleanups.current.push(cleanup));
  }, [query, results, waits]);
  useEffect(
    () => () => {
      for (const cleanup of queryCleanups.current.splice(0)) cleanup();
    },
    [],
  );

  const previousResultsQuery = useRef<[typeof results, typeof query] | undefined>(undefined);
  const resultsQueryCleanups = useRef<(() => void)[]>([]);
  const onResultsQueryChange = useEffectEvent(
    (
      resultsValue: typeof results,
      queryValue: typeof query,
      onCleanup: (cleanup: () => void) => void,
    ) => {
      const text = \`\${resultsValue.length} for "\${queryValue}"\`;
      onLogRef.current?.(
        \`effect \${text} \${document.querySelectorAll("[aria-label='Search'] li").length}\`,
      );
      onCleanup(() => onLogRef.current?.(\`effect cleanup \${text}\`));
    },
  );
  useEffect(() => {
    if (!Object.is(resultsRef.current, results)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousResultsQuery.current;
    if (previous && Object.is(previous[0], results) && Object.is(previous[1], query)) return;
    previousResultsQuery.current = [results, query];
    for (const cleanup of resultsQueryCleanups.current.splice(0)) cleanup();
    onResultsQueryChange(
      results,
      query,
      (cleanup) => void resultsQueryCleanups.current.push(cleanup),
    );
  }, [results, query, waits]);
  useEffect(
    () => () => {
      previousResultsQuery.current = undefined;
      for (const cleanup of resultsQueryCleanups.current.splice(0)) cleanup();
    },
    [],
  );

  const onUnmount = useEffectEvent(() => onLogRef.current?.("unmounted"));
  useEffect(() => () => onUnmount(), []);

  return (
    <section aria-label="Search">
      <button
        type="button"
        onClick={() => {
          queryRef.current = "vue";
          setQuery(queryRef.current);
        }}
      >
        Search
      </button>
      <button
        type="button"
        onClick={() => {
          resultsRef.current = [];
          setResults(resultsRef.current);
        }}
      >
        Clear
      </button>
      <ul ref={list}>
        {results.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
    </section>
  );
}
`,
  "Gated.tsx": `import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface GatedEvents {
  onLog?: (entry: string) => void;
}

export default function Gated({ onLog }: GatedEvents) {
  const onLogRef = useRef(onLog);
  useLayoutEffect(() => {
    onLogRef.current = onLog;
  });

  const [room, setRoom] = useState("general");
  const roomRef = useRef(room);
  const [members, setMembers] = useState<string[]>([]);
  const membersRef = useRef(members);
  const [low, setLow] = useState(1);
  const lowRef = useRef(low);
  const [high] = useState(2);

  const previousRoom = useRef(room);
  const onRoomChange = useEffectEvent((value: typeof room) => {
    membersRef.current = [value, \`\${value} bot\`];
    setMembers(membersRef.current);
  });
  useEffect(() => {
    const previous = previousRoom.current;
    if (Object.is(previous, room)) return;
    previousRoom.current = room;
    onRoomChange(room);
  }, [room]);

  const [waits, setWaits] = useState(0);
  const previousRoom_1 = useRef(room);
  const roomCleanups = useRef<(() => void)[]>([]);
  const onRoomChange_1 = useEffectEvent(
    (value: typeof room, previous: typeof room, onCleanup: (cleanup: () => void) => void) => {
      onLogRef.current?.(\`join \${value} from \${previous ?? "none"}\`);
      onCleanup(() => onLogRef.current?.(\`leave \${value}\`));
    },
  );
  useEffect(() => {
    if (!Object.is(membersRef.current, members)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousRoom_1.current;
    if (Object.is(previous, room)) return;
    previousRoom_1.current = room;
    for (const cleanup of roomCleanups.current.splice(0)) cleanup();
    onRoomChange_1(room, previous, (cleanup) => void roomCleanups.current.push(cleanup));
  }, [room, members, waits]);
  useEffect(
    () => () => {
      for (const cleanup of roomCleanups.current.splice(0)) cleanup();
    },
    [],
  );

  const previousLowHigh = useRef<[typeof low, typeof high]>([low, high]);
  const onLowHighChange = useEffectEvent(([a, b]: [typeof low, typeof high]) =>
    onLogRef.current?.(\`range \${a}-\${b}\`),
  );
  useEffect(() => {
    if (!Object.is(membersRef.current, members)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousLowHigh.current;
    if (Object.is(previous[0], low) && Object.is(previous[1], high)) return;
    previousLowHigh.current = [low, high];
    onLowHighChange([low, high]);
  }, [low, high, members, waits]);

  const previousMembers = useRef<[typeof members] | undefined>(undefined);
  const onMembersChange = useEffectEvent((membersValue: typeof members) => {
    onLogRef.current?.(\`members \${membersValue.length}\`);
  });
  useEffect(() => {
    if (!Object.is(membersRef.current, members)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousMembers.current;
    if (previous && Object.is(previous[0], members)) return;
    previousMembers.current = [members];
    onMembersChange(members);
  }, [members, waits]);

  const previousEffect = useRef<[] | undefined>(undefined);
  const onEffect = useEffectEvent(() => {
    onLogRef.current?.("effect");
  });
  useEffect(() => {
    if (!Object.is(membersRef.current, members)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousEffect.current;
    if (previous) return;
    previousEffect.current = [];
    onEffect();
  }, [members, waits]);

  const onMount = useEffectEvent(() => onLogRef.current?.("mounted"));
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => onLogRef.current?.("unmounted"));
  useEffect(() => () => onUnmount(), []);

  return (
    <section aria-label="Room">
      <button
        type="button"
        onClick={() => {
          roomRef.current = roomRef.current === "general" ? "random" : "general";
          setRoom(roomRef.current);
        }}
      >
        Switch
      </button>
      <button
        type="button"
        onClick={() => {
          membersRef.current = [];
          setMembers(membersRef.current);
        }}
      >
        Clear
      </button>
      <button
        type="button"
        onClick={() => {
          lowRef.current += 1;
          setLow(lowRef.current);
        }}
      >
        Low
      </button>
      <p>{members.join(", ")}</p>
    </section>
  );
}
`,
  "Shadow.tsx": `import { useRef, useState } from "react";

export interface ShadowEvents {
  onLog?: (entry: string) => void;
}

export default function Shadow({ onLog }: ShadowEvents) {
  const [clicks, setClicks] = useState(0);
  const clicksRef = useRef(clicks);
  const clickOnce = useOnce();
  const clickOnce_1 = useOnce();

  return (
    <div>
      <button
        type="button"
        onClick={(event) => {
          const clickListener = () => {
            const event = "plain";
            onLog?.(event);
          };
          clickListener();
          if (clickOnce(event)) {
            onLog?.(event.type);
          }
        }}
      >
        A
      </button>
      <button
        type="button"
        onClick={(event_1) => {
          clicksRef.current += 1;
          setClicks(clicksRef.current);
          if (clickOnce_1(event_1)) {
            const event = "first-click";
            onLog?.(event);
          }
        }}
      >
        B
      </button>
    </div>
  );
}

/** The guard of a listener that runs once per element, as \`{ once: true }\` makes it. */
function useOnce(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = useRef(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}
`,
  "Ticker.tsx": `import { useEffect, useEffectEvent, useRef, useState } from "react";

export default function Ticker() {
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(seconds);
  const [timer, setTimer] = useState<ReturnType<typeof setInterval>>();
  const timerRef = useRef(timer);
  const [label, setLabel] = useState("");
  const labelRef = useRef(label);

  function start() {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    setTimer(timerRef.current);
    labelRef.current = [1, 2]
      .map((n) => {
        secondsRef.current = n;
        setSeconds(secondsRef.current);
        return n;
      })
      .join(",");
    setLabel(labelRef.current);
  }

  const onUnmount = useEffectEvent(() => clearInterval(timerRef.current));
  useEffect(() => () => onUnmount(), []);

  return (
    <div>
      <p>
        {seconds} {label}
      </p>
      <button type="button" onClick={start}>
        Start
      </button>
      <button
        type="button"
        onClick={() => {
          timerRef.current = setTimeout(() => {
            secondsRef.current = 0;
            setSeconds(secondsRef.current);
          }, 10);
          setTimer(timerRef.current);
        }}
      >
        Reset
      </button>
    </div>
  );
}
`,
  "Escapable.tsx": `import { useLayoutEffect, useRef, useState } from "react";

export interface EscapableEvents {
  onClosed?: (reason: string) => void;
}

export default function Escapable({ onClosed }: EscapableEvents) {
  const onClosedRef = useRef(onClosed);
  useLayoutEffect(() => {
    onClosedRef.current = onClosed;
  });

  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  const [{ close, onEscape }] = useState(() => {
    function close(reason: string) {
      openRef.current = false;
      setOpen(openRef.current);
      document.removeEventListener("keydown", onEscape);
      onClosedRef.current?.(reason);
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close("escape");
    };

    return { close, onEscape };
  });

  function show() {
    openRef.current = true;
    setOpen(openRef.current);
    document.addEventListener("keydown", onEscape);
  }

  return (
    <div>
      <button type="button" aria-expanded={open} onClick={show}>
        Options
      </button>
      {open ? (
        <button type="button" onClick={() => close("button")}>
          Close
        </button>
      ) : null}
    </div>
  );
}
`,
  "Saver.tsx": `import { useLayoutEffect, useRef, useState } from "react";

interface Settings {
  theme: string;
  size: number;
}

export interface SaverEvents {
  onSaved?: (id: number) => void;
}

export default function Saver({ onSaved }: SaverEvents) {
  // React Compiler 1.0 cannot compile \`?.\` inside a \`try\` block yet: the component opts out of it.
  "use no memo";

  const onSavedRef = useRef(onSaved);
  useLayoutEffect(() => {
    onSavedRef.current = onSaved;
  });

  const [failed, setFailed] = useState(false);
  const failedRef = useRef(failed);
  const [settings, setSettings] = useState<Settings>({ theme: "light", size: 1 });
  const settingsRef = useRef(settings);

  async function save() {
    try {
      const id = await new Promise<number>((resolve) => setTimeout(() => resolve(1), 10));
      onSavedRef.current?.(id);
    } catch {
      failedRef.current = true;
      setFailed(failedRef.current);
    }
  }

  function apply(patch: Partial<Settings>) {
    const { theme = settingsRef.current.theme, size = settingsRef.current.size } = patch;
    settingsRef.current = { theme, size };
    setSettings(settingsRef.current);
  }

  return (
    <div>
      <button type="button" onClick={save}>
        Save
      </button>
      <button type="button" onClick={() => apply({ theme: "dark" })}>
        Dark
      </button>
      <p>{failed ? "Failed" : settings.theme}</p>
    </div>
  );
}
`,
  "Picker.tsx": `import { useLayoutEffect, useMemo, useRef, useState } from "react";

interface Member {
  id: number;
  name: string;
  email?: string;
}

export interface PickerProps {
  owner?: Member;
  pages: number;
}

export interface PickerEvents {
  onSelect?: (member: Member) => void;
  onMail?: (email: string) => void;
  onNamed?: (name: string) => void;
  onMoved?: (page: number) => void;
}

export default function Picker({
  owner,
  pages,
  onSelect,
  onMail,
  onNamed,
  onMoved,
}: PickerProps & PickerEvents) {
  const ownerRef = useRef(owner);
  const onNamedRef = useRef(onNamed);
  useLayoutEffect(() => {
    ownerRef.current = owner;
    onNamedRef.current = onNamed;
  });

  const [members] = useState<Member[]>([{ id: 1, name: "Ada", email: "ada@example.com" }]);
  const [chosen] = useState(1);
  const [page, setPage] = useState(1);
  const pageRef = useRef(page);
  const selected = useMemo(() => members.find((member) => member.id === chosen), [members, chosen]);

  function currentSelected() {
    return members.find((member) => member.id === chosen);
  }

  function pick() {
    if (currentSelected()) onSelect?.(currentSelected()!);
    if (currentSelected()?.email) onMail?.(currentSelected()!.email!);
  }

  function later() {
    if (!ownerRef.current) return;
    setTimeout(() => onNamedRef.current?.(ownerRef.current!.name), 10);
  }

  return (
    <div>
      <button type="button" onClick={pick}>
        Pick
      </button>
      <button type="button" onClick={later}>
        Later
      </button>
      {owner ? (
        <button type="button" onClick={() => onNamedRef.current?.(owner.name)}>
          Owner
        </button>
      ) : null}
      {page < pages ? (
        <button
          type="button"
          onClick={() => {
            pageRef.current += 1;
            setPage(pageRef.current);
            onMoved?.(pageRef.current);
          }}
        >
          Next
        </button>
      ) : null}
      <p>
        {selected ? selected.name : "None"} {page}
      </p>
    </div>
  );
}
`,
};
