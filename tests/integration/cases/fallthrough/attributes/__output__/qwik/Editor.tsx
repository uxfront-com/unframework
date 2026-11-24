import SaveButton from "./SaveButton";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const pressed = useSignal(false);

  return (
    <div class={["editor", className]} style={style} {...attributes}>
      <p id="save-hint">Saves the draft.</p>
      <SaveButton
        title="Save"
        id="save"
        aria-describedby="save-hint"
        aria-pressed={pressed.value}
        data-testid="save-button"
        type="submit"
        class={["primary"]}
      />
      <button type="button" onClick$={() => (pressed.value = !pressed.value)}>
        Toggle
      </button>
    </div>
  );
});
