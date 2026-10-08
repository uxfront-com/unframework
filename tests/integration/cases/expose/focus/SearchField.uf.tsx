import { defineExpose, useTemplateRef } from "unframework";

export default function SearchField({ label }: { label: string }) {
  const input = useTemplateRef<HTMLInputElement>();
  function focus() {
    input.value?.focus();
  }
  defineExpose({ focus });
  return (
    <label class="search">
      {label}
      <input ref={input} type="search" />
    </label>
  );
}
