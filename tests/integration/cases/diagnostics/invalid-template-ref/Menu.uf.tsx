// UF3027 invalid-template-ref: `ref={entry}` is on an element inside a list, where Vue gives an
// array of elements and the other targets the last one; a template ref holds one element.
import { useTemplateRef } from "unframework";

export interface MenuProps {
  items: string[];
}

export default function Menu({ items }: MenuProps) {
  const entry = useTemplateRef<HTMLButtonElement>();

  function focusEntry() {
    entry.value?.focus();
  }

  return (
    <div class="menu">
      <button type="button" onClick={focusEntry}>
        Focus the menu
      </button>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <button type="button" ref={entry}>
              {item}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
