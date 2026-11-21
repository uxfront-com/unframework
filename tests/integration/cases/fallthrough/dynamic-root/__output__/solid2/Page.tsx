import Base from "./Base";
import Primary from "./Primary";
import { Dynamic, type JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, untrack } from "solid-js";
import "./Page.uf.tsx.css";

export default function Page(props: { class?: string; style?: JSX.CSSProperties }) {
  const [linked, setLinked] = createState(true);
  const [tone, setTone] = createState("rgb(29, 78, 216)");
  const [pressed, setPressed] = createState("none");
  const [items] = createState([
    { id: 1, href: "#one", disabled: true, label: "One" },
    { id: 2, href: "", disabled: true, label: "Two" },
  ]);

  return (
    <section
      class={props.class ? `page ${props.class}` : "page"}
      data-uf-64cf7c28=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Primary
        href={linked() ? "#docs" : undefined}
        disabled={true}
        text="Docs"
        onPress={() => setPressed("docs")}
        class="wide"
        style={{ color: tone() }}
        data-uf-64cf7c28=""
      />
      <Base
        disabled={true}
        text="Off"
        onPress={() => setPressed("off")}
        class={cx("off", { muted: !linked() })}
        data-uf-64cf7c28=""
      />
      <Base text="Save" onPress={() => setPressed("save")} class="save" data-uf-64cf7c28="" />
      <ul aria-label="Items" data-uf-64cf7c28="">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <li data-uf-64cf7c28="">
              <Dynamic
                component={item.value.href ? "a" : "button"}
                href={(item.value.href ? "a" : "button") === "a" ? item.value.href : undefined}
                disabled={
                  (item.value.href ? "a" : "button") === "button" ? item.value.disabled : undefined
                }
                class="item"
                data-uf-64cf7c28=""
              >
                {item.value.label}
              </Dynamic>
            </li>
          )}
        </KeyedFor>
      </ul>
      <button
        type="button"
        onClick={() => {
          setLinked(!linked());
          setTone(linked() ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)");
        }}
        data-uf-64cf7c28=""
      >
        Toggle
      </button>
      <output data-uf-64cf7c28="">{pressed()}</output>
    </section>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
