// A child whose root is a `<component is>`: the tag it renders takes its styled parent's scope
// attribute.
export default function Heading({ big, text }: { big: boolean; text: string }) {
  return (
    <component is={big ? "h2" : "h3"} class="heading">
      {text}
    </component>
  );
}
