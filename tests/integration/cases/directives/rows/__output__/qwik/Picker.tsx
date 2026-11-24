import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface PickerSlots {
  option$?: QRL<(props: { option: { id: string; label: string } }) => JSXOutput>;
}

export default component$<
  PickerSlots &
    Omit<PropsOf<"div">, "option$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ option$, class: className, style, ...attributes }) => {
  const options = useSignal([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);

  return (
    <div class={["picker", className]} style={style} {...attributes}>
      <ul aria-label="Options">
        {options.value.map((option) => (
          <li key={option.id}>{option$?.({ option })}</li>
        ))}
      </ul>
      <button type="button" onClick$={() => (options.value = [...options.value].reverse())}>
        Reverse options
      </button>
      <button
        type="button"
        onClick$={() => (options.value = options.value.filter((option) => option.id !== "y"))}
      >
        Remove option
      </button>
    </div>
  );
});
