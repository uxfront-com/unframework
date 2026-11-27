import EachAction from "./EachAction";
import FadeFace from "./FadeFace";
import FramedNote from "./FramedNote";
import OnceAction from "./OnceAction";
import RowList from "./RowList";
import TagList from "./TagList";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type ShelfAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Shelf({ className, style, ...attributes }: ShelfAttributes) {
  const [bold, setBold] = useState(true);
  const boldRef = useRef(bold);

  return (
    <section className={cx("shelf", className)} style={style} {...attributes}>
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
      <FadeFace bold={bold}>Face</FadeFace>
      <button
        type="button"
        onClick={() => {
          boldRef.current = !boldRef.current;
          setBold(boldRef.current);
        }}
      >
        Swap face
      </button>
    </section>
  );
}
