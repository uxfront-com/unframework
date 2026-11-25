import Picker from "./Picker.uf.tsx";

interface Fruit {
  name: string;
  count: number;
}

// The harness parent (ADR-0057): its fill reads the members of its own item type.
export default function Fruits({ fruits }: { fruits: Fruit[] }) {
  return (
    <Picker items={fruits}>
      {{
        item: ({ item }) => (
          <span>
            {item.name} × {item.count}
          </span>
        ),
      }}
    </Picker>
  );
}
