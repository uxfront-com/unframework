import Lead from "./Lead";
import Member from "./Member";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  { ids: string[] } & Omit<PropsOf<"section">, "ids" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ ids, class: className, style, ...attributes }) => {
  const first = useSignal<{ reset(): void }>();

  return (
    <section class={["team", className]} aria-label="Team" style={style} {...attributes}>
      <h2>Team</h2>
      <button type="button" onClick$={() => first.value?.reset()}>
        Reset
      </button>
      <Member ref={first} id="ada" />
      <ul>
        {ids.map((id) => (
          <li key={id}>
            <Member id={id} />
          </li>
        ))}
      </ul>
      <Lead class={["lead"]} id="hopper" />
    </section>
  );
});
