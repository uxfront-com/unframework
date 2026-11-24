import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  Slot,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const open = useSignal(false);

  return (
    <div class={["card", className]} style={style} {...attributes}>
      <button type="button" onClick$={() => (open.value = !open.value)}>
        Toggle card
      </button>
      {open.value ? (
        <div class="body">
          <Slot />
        </div>
      ) : null}
    </div>
  );
});
