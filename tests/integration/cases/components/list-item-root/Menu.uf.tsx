import Item from "./Item.uf.tsx";

export default function Menu({ entries }: { entries: string[] }) {
  return (
    <ul aria-label="Menu">
      {entries.map((entry) => (
        <Item key={entry} label={entry} />
      ))}
    </ul>
  );
}
