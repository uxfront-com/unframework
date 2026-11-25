import Frame from "./Frame.uf.tsx";
import Mat from "./Mat.uf.tsx";

// Content filled three ways: into a slot, through a scoped slot, and into a `<component is>`,
// whose fill takes the `-s` of each candidate whose sheet uses `:slotted()`.
export default function Gallery({ matted = true }: { matted?: boolean }) {
  return (
    <section>
      <Frame>
        <p class="caption">A quiet harbour</p>
      </Frame>
      <Frame>{{ label: ({ text }) => <p class="caption">{text}</p> }}</Frame>
      <component is={matted ? Mat : Frame}>
        <p class="caption">A matted print</p>
      </component>
      <p class="caption">Outside the frame</p>
    </section>
  );
}
