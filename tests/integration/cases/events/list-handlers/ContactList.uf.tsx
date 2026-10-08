import { defineEmits, ref } from "unframework";

export interface Contact {
  id: string;
  name: string;
}

export interface ContactListProps {
  initial: Contact[];
}

export default function ContactList({ initial }: ContactListProps) {
  const emit = defineEmits<{ choose: [id: string, position: number]; removed: [name: string] }>();

  const contacts = ref(initial);
  const chosen = ref<string>();

  function pick(entry: Contact, position: number) {
    chosen.value = entry.id;
    emit("choose", entry.id, position);
  }

  function drop(entry: Contact) {
    contacts.value = contacts.value.filter((other) => other.id !== entry.id);
    emit("removed", entry.name);
  }

  return (
    <section class="contact-list" aria-label="Contacts">
      <ul>
        {contacts.value.map((contact, index) => (
          <li key={contact.id}>
            <button
              type="button"
              aria-pressed={chosen.value === contact.id}
              onClick={() => pick(contact, index)}
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
        ))}
      </ul>
      <p role="status">Chosen: {chosen.value ?? "nobody"}</p>
    </section>
  );
}
