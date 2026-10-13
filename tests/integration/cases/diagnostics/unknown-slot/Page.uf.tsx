// UF3038 unknown-slot: a slot object fills the slots the component declares; `title` is misspelt
// `tilte`, and the likely fix renames the key.
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
  return <Layout>{{ tilte: () => <span>Home</span>, default: () => <p>Welcome</p> }}</Layout>;
}
