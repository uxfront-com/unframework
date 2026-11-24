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
    <div class={["disclosure", className]} style={style} {...attributes}>
      <button type="button" aria-expanded={open.value} onClick$={() => (open.value = !open.value)}>
        Details
      </button>
      {open.value ? (
        <div class="body">
          <Slot />
        </div>
      ) : null}
    </div>
  );
});
