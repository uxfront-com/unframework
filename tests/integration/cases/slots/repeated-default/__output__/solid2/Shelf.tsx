import EachAction from "./EachAction";
import FadeFace from "./FadeFace";
import FramedNote from "./FramedNote";
import OnceAction from "./OnceAction";
import RowList from "./RowList";
import TagList from "./TagList";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Shelf(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [bold, setBold] = createState(true);

  return (
    <section class={props.class ? `shelf ${props.class}` : "shelf"} {...others}>
      <RowList label="Produce" items={["Apples", "Pears", "Plums"]}>
        <em>fresh</em>
      </RowList>
      <FramedNote title="Release notes">
        <strong>Draft</strong>
      </FramedNote>
      <TagList ordered={true} label="Ranked" items={["gold", "silver"]}>
        <span>Medal</span>
      </TagList>
      <TagList ordered={false} label="Unranked" items={["red", "blue"]}>
        <span>Colour</span>
      </TagList>
      <OnceAction href="#once" label="Once">
        Open once
      </OnceAction>
      <OnceAction label="Single">Press once</OnceAction>
      <EachAction href="#each" items={["one", "two"]}>
        Open each
      </EachAction>
      <EachAction items={["three", "four"]}>Press each</EachAction>
      <FadeFace bold={bold()}>Face</FadeFace>
      <button type="button" onClick={() => setBold(!bold())}>
        Swap face
      </button>
    </section>
  );
}
