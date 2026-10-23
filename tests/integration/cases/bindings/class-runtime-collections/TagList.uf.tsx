import { ref } from "unframework";

type TagStates = {
  selected?: boolean;
  muted?: boolean;
};

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

export default function TagList({ label, tags, states, extra }: TagListProps) {
  const expanded = ref(false);

  function expand() {
    expanded.value = !expanded.value;
  }

  return (
    <div class="tag-list">
      <span class={["tag", tags, states, { "tag-open": expanded.value }]}>{label}</span>
      <span class={tags}>Plain</span>
      <span class={[extra, expanded.value ? ["tag-wide", "tag-tall"] : []]}>Extra</span>
      <button type="button" onClick={expand}>
        Expand
      </button>
    </div>
  );
}
