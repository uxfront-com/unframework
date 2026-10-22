import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface Contact {
  id: string;
  name: string;
}

export interface ContactListProps {
  initial: Contact[];
}

export interface ContactListEvents {
  onChoose$?: QRL<(id: string, position: number) => void>;
  onRemoved$?: QRL<(name: string) => void>;
}

export default component$<
  ContactListProps & ContactListEvents & { class?: ClassList; style?: CSSProperties }
>(({ initial, onChoose$, onRemoved$, class: className, style, ...attributes }) => {
  const contacts = useSignal(initial);
  const chosen = useSignal<string>();

  const pick = $((entry: Contact, position: number) => {
    chosen.value = entry.id;
    onChoose$?.(entry.id, position);
  });

  const drop = $((entry: Contact) => {
    contacts.value = contacts.value.filter((other) => other.id !== entry.id);
    onRemoved$?.(entry.name);
  });

  return (
    <section
      class={["contact-list", className]}
      aria-label="Contacts"
      {...scopeAttributes(attributes)}
      style={style}
    >
      <ul>
        {contacts.value.map((contact, index) => (
          <li key={contact.id}>
            <button
              type="button"
              aria-pressed={chosen.value === contact.id}
              onClick$={() => pick(contact, index)}
            >
              {contact.name}
            </button>
            <button
              type="button"
              aria-label={`Remove ${contact.name}`}
              onClick$={() => drop(contact)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p role="status">Chosen: {chosen.value ?? "nobody"}</p>
    </section>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
