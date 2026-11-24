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
  const lead = useSignal(true);
  const guest = useSignal(false);

  return (
    <section class={["roster", className]} aria-label="Roster" style={style} {...attributes}>
      <button type="button" onClick$={() => (lead.value = !lead.value)}>
        Switch lead
      </button>
      <button type="button" onClick$={() => (guest.value = !guest.value)}>
        Toggle guest
      </button>
      <ul>
        {ids.map((id) => (
          <Member key={id} id={id} />
        ))}
        <>{lead.value ? <Member id="ada" /> : <Member id="linus" />}</>
        {guest.value ? <Member id="hopper" /> : null}
      </ul>
    </section>
  );
});
