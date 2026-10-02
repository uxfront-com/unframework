// Legitimate consumer code that must type-check under stock tsgo (plan §5.6 layer 1: "no false
// errors"). Nothing here may error. Payloads, model types and slot props are deliberately unchecked.
import { ref, useTemplateRef, type Element } from "unframework";

import Button from "../fixtures/Button.uf.tsx";
import Counter from "../fixtures/Counter.uf.tsx";
import Dialog from "../fixtures/Dialog.uf.tsx";
import List, { type Item } from "../fixtures/List.uf.tsx";

export function Consumers() {
  const open = ref(false);
  const value = ref("");
  const items = ref<Item[]>([]);
  const dialog = useTemplateRef<{ focus(): void }>();
  const last = ref(0);

  return (
    <section>
      {/* Events declared by defineEmits: any on${Capitalize<string>} handler, payload `any`. */}
      <Counter onChange={(next) => (last.value = next)} />
      <Counter onAnything={() => {}} onChangeOnce={() => {}} />

      {/* Named and default models. */}
      <Dialog label="Settings" v-model:open={open.value} />
      <Dialog label="Settings" v-model={value.value} />

      {/* Default slot as children, named slots as a slot object, scoped slot props `any`. */}
      <Dialog label="Plain">
        Body text and <b>markup</b>
      </Dialog>
      <Dialog label="Slots" ref={dialog}>
        {{
          default: () => <p>Body</p>,
          title: () => "A string title",
        }}
      </Dialog>
      <List items={items.value} onSelect={(item, index) => console.log(item.name, index)}>
        {{
          item: ({ item, index }) => (
            <span key={item.id}>
              {index}: {item.name}
            </span>
          ),
          empty: () => [<i>none</i>, " yet"],
        }}
      </List>

      {/* Literal-union props, and a named slot the component tests for presence. */}
      <Button size="lg" href="/docs">
        {{ default: () => "Docs", icon: () => <i class="icon" /> }}
      </Button>
      <Button disabled>Plain</Button>

      {/* key, fallthrough class/style, hyphenated attributes. */}
      {items.value.map((item) => (
        <Counter
          key={item.id}
          class={["c", { active: open.value }]}
          style={{ color: "red" }}
          aria-label={item.name}
          data-id={item.id}
        />
      ))}
    </section>
  );
}

export function SlotDeclaredWithElementAlias() {
  // `Element` is re-exported from the root so slot types need one import, not a second JSX import.
  const render = (): Element => <b>x</b>;
  return <List items={[]}>{{ empty: render }}</List>;
}
