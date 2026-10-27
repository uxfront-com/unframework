// The generic child: `T` is the type of its items, which a parent's `items` gives. Its nested
// call passes `T` on the tag, and the likely fix removes it: the nested items give it.
export interface TreeProps<T extends { id: string; name: string; children: T[] }> {
  items: T[];
}

export default function Tree<T extends { id: string; name: string; children: T[] }>({
  items,
}: TreeProps<T>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.name}
          <Tree<T> items={item.children} />
        </li>
      ))}
    </ul>
  );
}
