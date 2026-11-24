import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface DisclosureModels {
  open?: boolean;
  onOpenChange$?: QRL<(open: boolean) => void>;
}

export default component$<
  { title: string } & DisclosureModels &
    Omit<PropsOf<"div">, "title" | "open" | "onOpenChange$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, open: openProp, onOpenChange$, class: className, style, ...attributes }) => {
  const openLocal = useSignal<boolean>(false);
  const open = useComputed$(() => (openProp === undefined ? openLocal.value : openProp));

  const setOpen = $(async (next: boolean) => {
    if (openProp === undefined) openLocal.value = next;
    await onOpenChange$?.(next);
  });

  return (
    <div class={["disclosure", className]} style={style} {...attributes}>
      <button type="button" aria-expanded={open.value} onClick$={() => setOpen(!open.value)}>
        {title}
      </button>
      {open.value ? <p>Details of {title}</p> : null}
    </div>
  );
});
