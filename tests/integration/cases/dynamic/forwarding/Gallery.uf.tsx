import Frame from "./Frame.uf.tsx";

export default function Gallery() {
  return (
    <div>
      <Frame label="Card" wide={false}>
        {{ title: () => <>Sunset</> }}
      </Frame>
      <Frame label="Panel" wide={true}>
        {{ title: () => <>Dawn</> }}
      </Frame>
      <Frame label="Empty" wide={true} />
    </div>
  );
}
