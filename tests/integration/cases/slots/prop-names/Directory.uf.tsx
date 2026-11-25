import Table from "./Table.uf.tsx";

export interface Person {
  id: string;
  name: string;
}

export default function Directory({ people }: { people: Person[] }) {
  return (
    <Table people={people}>
      {{
        row: ({ name, "data-id": id, index }) => (
          <span>
            {index + 1}: {name} ({id})
          </span>
        ),
      }}
    </Table>
  );
}
