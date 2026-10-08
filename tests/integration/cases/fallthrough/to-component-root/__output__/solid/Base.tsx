export default function Base(props: { text: string }) {
  return (
    <button type="button" class="base">
      {props.text}
    </button>
  );
}
