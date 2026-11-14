export interface Entry {
  id: string;
  label: string;
}

export interface ChecklistProps {
  entries: Entry[];
}

export default function Checklist({ entries }: ChecklistProps) {
  return (
    <ul class="checklist">
      {entries.map((entry) => (
        <li key={entry.id}>
          <label>
            {entry.label}
            <input name={`note-${entry.id}`} aria-label={`Note for ${entry.label}`} />
          </label>
        </li>
      ))}
    </ul>
  );
}
