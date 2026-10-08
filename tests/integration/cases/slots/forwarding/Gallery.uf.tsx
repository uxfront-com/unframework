import Frame from "./Frame.uf.tsx";

export default function Gallery() {
  return (
    <div>
      <Frame label="Filled">
        {{ title: () => <>Sunset</>, default: () => <p>Taken at dusk.</p> }}
      </Frame>
      <Frame label="Empty" />
    </div>
  );
}
