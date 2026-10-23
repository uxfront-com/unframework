import "virtual:styleframe.css";

export default function Note({ text }: { text: string }) {
  return <p class="_padding:md _background-color:surface _color:text">{text}</p>;
}
