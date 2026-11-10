// A type parameter with a constraint (ADR-0068): the rows are keyed and labelled by members the
// constraint declares.
export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

export default function Table<T extends { id: string; label: string }>({
  caption,
  rows,
}: TableProps<T>) {
  return (
    <table>
      <caption>{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row">{row.id}</th>
            <td>{row.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
