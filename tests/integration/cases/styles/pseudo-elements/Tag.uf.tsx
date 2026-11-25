import "./Tag.css";

export default function Tag({ name }: { name: string }) {
  return <span class="tag">{name}</span>;
}
