import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, splitProps, untrack } from "solid-js";

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
    Omit<ComponentProps<"section">, "initial" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["initial", "onChoose", "onRemoved", "class"]);

  const [contacts, setContacts] = createSignal(untrack(() => props.initial));
  const [chosen, setChosen] = createSignal<string>();

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
                aria-pressed={chosen() === contact.value.id}
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
