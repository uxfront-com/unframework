import { ref, useTemplateRef } from "unframework";

export default function ShirtOrder() {
  const size = ref("M");
  const quantity = ref(1);
  const note = ref("");
  const noteField = useTemplateRef<HTMLInputElement>();

  return (
    <section class="shirt-order" aria-label="Shirt order">
      <p role="status">{`${quantity.value} x size ${size.value}`}</p>
      <div role="group" aria-label="Size">
        <button
          type="button"
          value="S"
          aria-pressed={size.value === "S"}
          onClick={(event) => (size.value = (event.currentTarget as HTMLButtonElement).value)}
        >
          Small
        </button>
        <button
          type="button"
          value="M"
          aria-pressed={size.value === "M"}
          onClick={(event) => (size.value = (event.currentTarget as HTMLButtonElement).value)}
        >
          Medium
        </button>
        <button
          type="button"
          value="L"
          aria-pressed={size.value === "L"}
          onClick={(event) => (size.value = (event.currentTarget as HTMLButtonElement).value)}
        >
          Large
        </button>
      </div>
      <button type="button" onClick={() => quantity.value++}>
        Add one
      </button>
      <label>
        Note
        <input
          name="note"
          ref={noteField}
          onInput={(event) => (note.value = (event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <p>Note: {note.value}</p>
      <button
        type="button"
        onClick={() => {
          quantity.value = 1;
          size.value = "M";
          note.value = "";
          const input = noteField.value;
          if (input) input.value = "";
        }}
      >
        Reset
      </button>
    </section>
  );
}
