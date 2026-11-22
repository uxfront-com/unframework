import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

export default component$<
  TagListProps &
    Omit<PropsOf<"div">, "label" | "tags" | "states" | "extra" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, tags, states, extra, class: className, style, ...attributes }) => {
  const expanded = useSignal(false);

  const expand = $(() => {
    expanded.value = !expanded.value;
  });

  return (
    <div class={["tag-list", className]} style={style} {...attributes}>
      <span class={["tag", tags, states, { "tag-open": Boolean(expanded.value) }]}>{label}</span>
      <span class={tags}>Plain</span>
      <span class={[extra, expanded.value ? ["tag-wide", "tag-tall"] : []]}>Extra</span>
      <button type="button" onClick$={expand}>
        Expand
      </button>
    </div>
  );
});
