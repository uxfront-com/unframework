import Base from "./Base";
import Primary from "./Primary";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const linked = useSignal(true);
  const log = useSignal<string[]>([]);
  const direct = useSignal<HTMLAnchorElement | HTMLButtonElement>();
  const chained = useSignal<HTMLAnchorElement | HTMLButtonElement>();

  const record = $((line: string) => {
    log.value = [...log.value, line];
  });

  return (
    <section aria-label="Page" class={className} style={style} {...attributes}>
      <Base
        href={linked.value ? "#direct" : undefined}
        text="Direct"
        id="direct"
        aria-label="Direct"
        data-testid="direct"
        title="Go"
        onClick$={(_: PointerEvent, element: Element) =>
          record(`click on ${(element as Element).localName}`)
        }
        onKeyDown$={(event: KeyboardEvent, element: Element) =>
          record(`keydown ${event.key} on ${(element as Element).localName}`)
        }
        ref={direct}
      />
      <Primary
        href={linked.value ? "#chained" : undefined}
        text="Chained"
        id="chained"
        aria-label="Chained"
        data-testid="chained"
        onClick$={(_: PointerEvent, element: Element) =>
          record(`chained on ${(element as Element).localName}`)
        }
        ref={chained}
      />
      <button type="button" onClick$={() => (linked.value = !linked.value)}>
        Toggle
      </button>
      <button type="button" onClick$={() => direct.value?.focus()}>
        Focus direct
      </button>
      <button type="button" onClick$={() => chained.value?.focus()}>
        Focus chained
      </button>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
});
