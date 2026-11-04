// A component generic over its items (ADR-0068): `T` is what its consumer's `items` holds.
export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

export default function List<T>({ label, items, selected }: ListProps<T>) {
  return (
    <ul aria-label={label}>
      {items.map((item, index) => (
        <li key={index} aria-current={item === selected ? "true" : undefined}>
          {String(item)}
        </li>
      ))}
    </ul>
  );
}
