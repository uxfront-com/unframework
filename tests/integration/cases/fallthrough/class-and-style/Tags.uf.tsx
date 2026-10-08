import { ref } from "unframework";

import Tag from "./Tag.uf.tsx";

export default function Tags() {
  const active = ref(false);
  return (
    <div class="tags">
      <Tag label="plain" />
      <Tag label="wide" class="wide" style="margin-left: 8px" />
      <Tag
        label="toggled"
        class={["picked", { active: active.value }]}
        style={{ color: active.value ? "rgb(200, 0, 0)" : undefined }}
      />
      <button type="button" onClick={() => (active.value = !active.value)}>
        Toggle
      </button>
    </div>
  );
}
