import { defineModel } from "unframework";

export default function Disclosure({ title }: { title: string }) {
  const open = defineModel<boolean>("open", { default: false });
  return (
    <div class="disclosure">
      <button type="button" aria-expanded={open.value} onClick={() => (open.value = !open.value)}>
        {title}
      </button>
      {open.value && <p>Details of {title}</p>}
    </div>
  );
}
