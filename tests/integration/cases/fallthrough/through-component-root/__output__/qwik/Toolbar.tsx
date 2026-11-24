import SaveAction from "./SaveAction";
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
  const clicks = useSignal(0);
  const save = useSignal<HTMLButtonElement>();

  return (
    <div role="toolbar" aria-label="Actions" class={className} style={style} {...attributes}>
      <SaveAction
        ref={save}
        text="Save"
        id="save"
        aria-label="Save draft"
        onClick$={() => clicks.value++}
      />
      <button type="button" onClick$={() => save.value?.focus()}>
        Focus save
      </button>
      <p>Clicks: {clicks.value}</p>
    </div>
  );
});
