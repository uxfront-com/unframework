import { type CSSProperties, useRef, useState } from "react";

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

export interface ContactListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ContactList({
  initial,
  onChoose,
  onRemoved,
  className,
  style,
}: ContactListProps & ContactListEvents & ContactListAttributes) {
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
    <section className={cx("contact-list", className)} aria-label="Contacts" style={style}>
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
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
