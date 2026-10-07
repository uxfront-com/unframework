import { $, type QRL, component$, useSignal } from "@qwik.dev/core";

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

export default component$<ContactListProps & ContactListEvents>(
  ({ initial, onChoose$, onRemoved$ }) => {
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
      <section class="contact-list" aria-label="Contacts">
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
  },
);
