// Consumers of a generic component (ADR-0068) that must type-check under stock tsgo: `T` is inferred
// from the props, and the open layer-1 surface of `LibraryManagedAttributes` adds no false error.
import { ref } from "unframework";

import Select from "../fixtures/Select.uf.tsx";
import type { Option } from "../fixtures/types.ts";

interface User extends Option {
  email: string;
}

export function GenericConsumers() {
  const users = ref<User[]>([]);
  const picked = ref<User>();
  const email = ref("");

  return (
    <section>
      {/* `T` is User, from `options`; the model, the event and the scoped slot are accepted. */}
      <Select
        options={users.value}
        v-model:selected={picked.value}
        onPick={(user) => (email.value = user.email)}
      >
        {{ option: ({ option, active }) => <span class={{ active }}>{option.email}</span> }}
      </Select>
      {/* `T` from an inline list, with the optional prop. */}
      <Select options={[{ id: "a", label: "A" }]} label="Letters" />
      {/* key, ref, class and style on a generic component. */}
      {users.value.map((user) => (
        <Select key={user.id} options={[user]} class="inline" style={{ display: "flex" }} />
      ))}
      {/* Explicit JSX type arguments: TypeScript accepts them. Caught by: compiler (UF6006). */}
      <Select<User> options={users.value} />
    </section>
  );
}

// A generic component written beside its consumer, with a constrained and defaulted parameter.
function Table<Row extends Option = Option>({ rows, current }: { rows: Row[]; current?: Row }) {
  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} aria-current={row.id === current?.id}>
            <td>{row.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LocalGeneric() {
  return <Table rows={[{ id: "1", label: "One", extra: true }]} />;
}
