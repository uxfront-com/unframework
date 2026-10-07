import { defineEmits, ref } from "unframework";

export interface Choice {
  id: string;
  label: string;
}

// A list's handler passes its event to a function, whose `preventDefault()` and
// `event.currentTarget` must still act as the event is dispatched and read its element.
export default function Picker({ choices }: { choices: Choice[] }) {
  const emit = defineEmits<{ picked: [id: string, text: string] }>();

  const chosen = ref("none");

  function pick(choice: Choice, event: MouseEvent) {
    event.preventDefault();
    chosen.value = choice.id;
    emit("picked", choice.id, (event.currentTarget as HTMLAnchorElement).text);
  }

  return (
    <nav aria-label="Choices">
      <ul>
        {choices.map((choice) => (
          <li key={choice.id}>
            <a href={`/choices/${choice.id}`} onClick={(event) => pick(choice, event)}>
              {choice.label}
            </a>
          </li>
        ))}
      </ul>
      <p role="status">{chosen.value}</p>
    </nav>
  );
}
