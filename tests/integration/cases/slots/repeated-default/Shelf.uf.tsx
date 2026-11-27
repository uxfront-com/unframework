import { ref } from "@uxfront/unframework";

import EachAction from "./EachAction.uf.tsx";
import FadeFace from "./FadeFace.uf.tsx";
import FramedNote from "./FramedNote.uf.tsx";
import OnceAction from "./OnceAction.uf.tsx";
import RowList from "./RowList.uf.tsx";
import TagList from "./TagList.uf.tsx";

export default function Shelf() {
  const bold = ref(true);
  return (
    <section class="shelf">
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
      <FadeFace bold={bold.value}>Face</FadeFace>
      <button type="button" onClick={() => (bold.value = !bold.value)}>
        Swap face
      </button>
    </section>
  );
}
