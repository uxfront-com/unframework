// UF6006 generic-instantiation: a generic component infers its type arguments from the props its
// consumer passes. A generic component is no candidate of `<component is>`: no one type argument
// types the props of every candidate. Tree's own call writes them on its tag, `<Tree<T>`, which
// no target's template can (`Tree.uf.tsx`).
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
  return <component is={compact ? Count : Tree} items={items} />;
}
