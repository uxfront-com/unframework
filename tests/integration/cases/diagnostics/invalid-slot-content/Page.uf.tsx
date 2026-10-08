// UF3040 invalid-slot-content: a slot object's members are arrow functions that return JSX, and
// a `title` written as a string is none.
import { defineSlots } from "unframework";
import type { Element } from "unframework";

function Layout() {
  const slots = defineSlots<{ title?(): Element; default?(): Element }>();
  return (
    <main>
      <h1>{slots.title?.()}</h1>
      {slots.default?.()}
    </main>
  );
}

export default function Page() {
  return <Layout>{{ title: "Home", default: () => <p>Welcome</p> }}</Layout>;
}
