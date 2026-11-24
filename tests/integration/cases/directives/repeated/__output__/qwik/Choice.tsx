import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface ChoiceSlots {
  body$?: QRL<() => JSXOutput>;
}

export default component$<
  ChoiceSlots &
    Omit<PropsOf<"div">, "body$" | "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ body$, class: className, style, ...attributes }) => {
  const first = useSignal(true);

  return (
    <div class={["choice", className]} style={style} {...attributes}>
      <>{first.value ? <b>{body$?.()}</b> : <i>{body$?.()}</i>}</>
      <button type="button" onClick$={() => (first.value = !first.value)}>
        Switch
      </button>
    </div>
  );
});
