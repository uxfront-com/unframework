export default function Heading({ tag, text }: { tag: "h1" | "h2" | "h3"; text: string }) {
  return (
    <component is={tag} class="heading">
      {text}
    </component>
  );
}
