export default function Row(props: { name: string; done: boolean }) {
  return (
    <div role="listitem" class="row" classList={{ done: props.done }}>
      {props.name}
      {props.done ? " (done)" : ""}
    </div>
  );
}
