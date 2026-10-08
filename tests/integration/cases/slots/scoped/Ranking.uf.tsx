import List from "./List.uf.tsx";

export default function Ranking({ names }: { names: string[] }) {
  return (
    <div>
      <List items={names} label="Podium">
        {{
          item: ({ item, index }) => (
            <span>
              {index + 1}. <b>{item}</b>
            </span>
          ),
        }}
      </List>
      <List items={names} label="Initials">
        {{ item: (entry) => <i>{entry.item.slice(0, 1)}</i> }}
      </List>
    </div>
  );
}
