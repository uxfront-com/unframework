import "virtual:styleframe.css";

export default function Themed({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <section
      data-theme={dark ? "dark" : "light"}
      class="_padding:md _background-color:surface _color:text"
    >
      {text}
    </section>
  );
}
