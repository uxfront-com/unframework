export default function Tag({ label }: { label: string }) {
  return (
    <span class="tag" style="padding: 2px 6px; color: rgb(30, 30, 30)">
      {label}
    </span>
  );
}
