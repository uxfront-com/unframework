import { useRef, useState } from "react";

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

export default function ContactList({
  initial,
  onChoose,
  onRemoved,
}: ContactListProps & ContactListEvents) {
  const [contacts, setContacts] = useState(initial);
  const contactsRef = useRef(contacts);
  const [chosen, setChosen] = useState<string>();
  const chosenRef = useRef(chosen);

  function pick(entry: Contact, position: number) {
    chosenRef.current = entry.id;
    setChosen(chosenRef.current);
    onChoose?.(entry.id, position);
  }

  function drop(entry: Contact) {
    contactsRef.current = contactsRef.current.filter((other) => other.id !== entry.id);
    setContacts(contactsRef.current);
    onRemoved?.(entry.name);
  }

  return (
    <section className="contact-list" aria-label="Contacts">
      <ul>
        {contacts.map((contact, index) => (
          <li key={contact.id}>
            <button
              type="button"
              aria-pressed={chosen === contact.id}
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
      <p role="status">Chosen: {chosen ?? "nobody"}</p>
    </section>
  );
}
