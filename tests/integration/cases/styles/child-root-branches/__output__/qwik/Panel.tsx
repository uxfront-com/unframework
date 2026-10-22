import Heading from "./Heading";
import Status from "./Status";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <section class={["panel", className]} data-uf-34db6205="" style={style}>
        <Heading big={true} text="Release" data-uf-34db6205="" />
        <Heading big={false} text="Notes" data-uf-34db6205="" />
        <Status busy={false} text="Save" data-uf-34db6205="" />
        <Status busy={true} text="Save" data-uf-34db6205="" />
      </section>
    );
  },
);
