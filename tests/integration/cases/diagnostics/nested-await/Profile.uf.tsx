// UF2038 nested-await: an async setup awaits only as the whole value of a top-level `const` that
// declares one name, so a destructured await, an await inside a larger expression, a bare await
// and an await inside an `if` are rejected.
import { loadUser } from "./api";

export default async function Profile({ id }: { id: string }) {
  const { name } = await loadUser(id);
  const visits = (await loadUser(id)).visits;
  await loadUser(id);
  if (id) {
    await loadUser(id);
  }
  return (
    <p>
      {name} {visits}
    </p>
  );
}
