import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

export interface ProfileFieldsEvents {
  onFirstNickname?: (nickname: string) => void;
}

export default function ProfileFields(
  props: ProfileFieldsEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onFirstNickname", "class");

  const [log, setLog] = createState<string[]>([]);
  const [nickname, setNickname] = createState("");
  const [cardFocuses, setCardFocuses] = createState(0);
  const [cardBlurs, setCardBlurs] = createState(0);

  function record(line: string) {
    setLog([...log(), line]);
  }

  function hold(event: MouseEvent) {
    event.preventDefault();
    record("locked click");
  }

  return (
    <section
      class={props.class ? `profile-fields ${props.class}` : "profile-fields"}
      aria-label="Profile"
      {...others}
    >
      <div
        class="name-group"
        role="group"
        aria-label="Name fields"
        onFocusIn={() => record("group focusin")}
        onFocusOut={() => record("group focusout")}
      >
        <label>
          Name
          <input
            name="name"
            onFocus={() => record("name focus")}
            onBlur={() => record("name blur")}
          />
        </label>
      </div>
      <label>
        Nickname
        <input
          name="nickname"
          ref={(element) => {
            element.addEventListener("change", (event) =>
              setNickname((event.currentTarget as HTMLInputElement).value),
            );
            element.addEventListener(
              "change",
              (event) => props.onFirstNickname?.((event.currentTarget as HTMLInputElement).value),
              { once: true },
            );
          }}
        />
      </label>
      <p>Nickname: {nickname()}</p>
      <label>
        <input
          type="checkbox"
          name="public"
          onClick={() => record("public click")}
          onInput={() => record("public input")}
          onChange={() => record("public change")}
        />
        Public profile
      </label>
      <label>
        <input
          type="checkbox"
          name="locked"
          onClick={hold}
          onChange={() => record("locked change")}
        />
        Locked
      </label>
      <div
        class="card"
        role="group"
        aria-label="Card"
        tabindex="-1"
        onFocus={() => setCardFocuses(cardFocuses() + 1)}
        onBlur={() => setCardBlurs(cardBlurs() + 1)}
      >
        <p>{cardFocuses() > cardBlurs() ? "Card focused" : "Card not focused"}</p>
        <p>Card blurs: {cardBlurs()}</p>
        <button type="button" onClick={() => record("card button")}>
          Inside the card
        </button>
      </div>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(entry, index) => index}>
          {(entry) => <li>{entry.value}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
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
