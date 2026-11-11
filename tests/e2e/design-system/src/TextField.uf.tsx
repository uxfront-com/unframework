import { defineModel } from "@uxfront/unframework";

export default function TextField({ label }: { label: string }) {
  const value = defineModel<string>("value", { default: "" });
  return (
    <label class="text-field">
      {label} <input v-model={value.value} />
    </label>
  );
}
