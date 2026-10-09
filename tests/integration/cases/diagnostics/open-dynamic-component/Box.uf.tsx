// UF3044 open-dynamic-component: `<component is>` chooses from a statically known set, and a
// prop typed `string` may name any tag.
export default function Box({ tag }: { tag: string }) {
  return (
    <component is={tag} class="box">
      Content
    </component>
  );
}
