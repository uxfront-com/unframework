// UF3056 invalid-directive-use: a directive goes on an element, with a value that is not built
// in place, so one on a component, one with an object literal and one without a value are
// rejected.
import { defineDirective } from "@uxfront/unframework";

const vHint = defineDirective<{ text: string }>({
  mounted(el, value) {
    el.title = value.text;
  },
});

function Item() {
  return <span>Item</span>;
}

export default function Toolbar() {
  return (
    <div class="toolbar">
      <Item v-hint={{ text: "Item" }} />
      <span v-hint={{ text: "Literal" }}>Literal</span>
      <span v-hint>Bare</span>
    </div>
  );
}
