import EachAction from "./EachAction";
import FadeFace from "./FadeFace";
import FramedNote from "./FramedNote";
import OnceAction from "./OnceAction";
import RowList from "./RowList";
import TagList from "./TagList";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function Shelf(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [bold, setBold] = createSignal(true);

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
