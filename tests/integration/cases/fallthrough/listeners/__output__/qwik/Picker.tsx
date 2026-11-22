import Chip from "./Chip";
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
  const log = useSignal<string[]>([]);

  const record = $((line: string) => {
    log.value = [...log.value, line];
  });

  return (
    <section aria-label="Picker" class={className} style={style} {...attributes}>
      <Chip
        label="Ada"
        onClick$={(_, element) => record(`click on ${(element as Element).localName}`)}
        onPick$={(label) => record(`pick ${label}`)}
        onFocus$={(_, element) => record(`focus on ${(element as Element).localName}`)}
        onKeyDown$={(event, element) =>
          record(`keydown ${event.key} on ${(element as Element).localName}`)
        }
      />
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
});
