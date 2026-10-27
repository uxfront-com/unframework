// UF6006 generic-instantiation: a generic component infers its type arguments from the props its
// consumer passes. `<Tree<Fruit>` writes them on the tag, which no target's template can, and the
// likely fix removes them. A generic component is no candidate of `<component is>` either: no one
// type argument types the props of every candidate. Tree's own call writes them too
// (`Tree.uf.tsx`).
import Tree from "./Tree.uf.tsx";

interface Fruit {
  id: string;
  name: string;
  children: Fruit[];
}

function Count({ items }: { items: Fruit[] }) {
  return <p>{items.length} fruits</p>;
}

export default function Fruits({ items, compact }: { items: Fruit[]; compact: boolean }) {
  return (
    <section>
      <Tree<Fruit> items={items} />
      <component is={compact ? Count : Tree} items={items} />
    </section>
  );
}
