import { For, type JSX, createSignal, untrack } from "solid-js";

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
  props: ContactListProps & ContactListEvents & { class?: string; style?: JSX.CSSProperties },
) {
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
      style={props.style}
      {...scopeAttributes(props)}
    >
      <ul>
        <For each={contacts()}>
          {(contact, index) => (
            <li>
              <button
                type="button"
                aria-pressed={chosen() === contact.id}
                onClick={() => pick(contact, index())}
              >
                {contact.name}
              </button>
              <button
                type="button"
                aria-label={`Remove ${contact.name}`}
                onClick={() => drop(contact)}
              >
                Remove
              </button>
            </li>
          )}
        </For>
      </ul>
      <p role="status">Chosen: {chosen() ?? "nobody"}</p>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
