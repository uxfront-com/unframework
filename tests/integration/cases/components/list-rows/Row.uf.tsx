export default function Row({ name, done }: { name: string; done: boolean }) {
  return (
    <div role="listitem" class={["row", { done }]}>
      {name}
      {done ? " (done)" : ""}
    </div>
  );
}
