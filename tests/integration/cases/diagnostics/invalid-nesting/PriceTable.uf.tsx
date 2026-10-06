// UF3003 invalid-nesting: rows from a list directly in a <table>, where the HTML parser would
// insert a <tbody>; placement is checked through the list.
export interface PriceTableProps {
  plans: string[];
}

export default function PriceTable({ plans }: PriceTableProps) {
  return (
    <table>
      {plans.map((plan) => (
        <tr key={plan}>
          <td>{plan}</td>
        </tr>
      ))}
    </table>
  );
}
