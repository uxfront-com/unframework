import Badge from "./Badge.uf.tsx";
import Tag from "./Tag.uf.tsx";

export default function Labels() {
  return (
    <section class="labels" aria-label="Labels">
      <Badge label="New" />
      <Tag name="docs" />
    </section>
  );
}
