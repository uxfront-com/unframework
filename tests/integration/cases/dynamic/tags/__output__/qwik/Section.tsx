import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ title: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ title, class: className, style }) => {
    const nested = useSignal(false);

    const Tag = nested.value ? "h3" : "h2";

    return (
      <article class={className} style={style}>
        <>
          <Tag class="title">{title}</Tag>
        </>
        <button type="button" onClick$={() => (nested.value = !nested.value)}>
          {nested.value ? "Lift" : "Nest"}
        </button>
      </article>
    );
  },
);
