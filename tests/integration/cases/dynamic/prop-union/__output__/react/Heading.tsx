export default function Heading({ tag, text }: { tag: "h1" | "h2" | "h3"; text: string }) {
  const Tag = tag;

  return <Tag className="heading">{text}</Tag>;
}
