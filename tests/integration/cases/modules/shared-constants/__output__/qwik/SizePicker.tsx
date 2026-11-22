import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"fieldset">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const size = useSignal<Size>(DEFAULT_SIZE);

  const pick = $((next: Size) => {
    size.value = next;
  });

  return (
    <fieldset class={["size-picker", className]} style={style} {...attributes}>
      <legend>Size</legend>
      <p role="status">Picked: {SIZES[size.value]}</p>
      <ul>
        {SIZE_ORDER.map((each) => (
          <li key={each}>
            <button type="button" aria-pressed={size.value === each} onClick$={() => pick(each)}>
              {SIZES[each]}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
});
