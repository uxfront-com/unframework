import Bio from "./Bio";
import NameField from "./NameField";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"form">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const name = useSignal<HTMLInputElement>();
  const bio = useSignal<HTMLInputElement>();

  return (
    <form aria-label="Profile" class={className} style={style} {...attributes}>
      <NameField ref={name} label="Name" />
      <button type="button" onClick$={() => name.value?.focus()}>
        Edit name
      </button>
      <Bio ref={bio} label="Bio" />
      <button type="button" onClick$={() => bio.value?.focus()}>
        Edit bio
      </button>
    </form>
  );
});
