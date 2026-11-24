import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

export interface Contact {
  id: string;
  name: string;
}

export interface ContactListProps {
  initial: Contact[];
}

export interface ContactListEvents {
  onChoose?: (id: string, position: number) => void;
  onRemoved?: (name: string) => void;
}

export default function ContactList(
  props: ContactListProps &
    ContactListEvents &
    Omit<ComponentProps<"section">, "initial" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "initial", "onChoose", "onRemoved", "class");

  const [contacts, setContacts] = createState(untrack(() => props.initial));
  const [chosen, setChosen] = createState<string>();

  function pick(entry: Contact, position: number) {
    setChosen(entry.id);
    props.onChoose?.(entry.id, position);
  }

  function drop(entry: Contact) {
    setContacts(contacts().filter((other) => other.id !== entry.id));
    props.onRemoved?.(entry.name);
  }

  return (
    <section
      class={props.class ? `contact-list ${props.class}` : "contact-list"}
      aria-label="Contacts"
      {...others}
    >
      <ul>
        <KeyedFor each={contacts()} by={(contact) => contact.id}>
          {(contact) => (
            <li>
              <button
                type="button"
                aria-pressed={enumeratedValue(chosen() === contact.value.id)}
                onClick={() => pick(contact.value, contact.index)}
              >
                {contact.value.name}
              </button>
              <button
                type="button"
                aria-label={`Remove ${contact.value.name}`}
                onClick={() => drop(contact.value)}
              >
                Remove
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
      <p role="status">Chosen: {chosen() ?? "nobody"}</p>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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
