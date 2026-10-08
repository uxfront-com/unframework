export default function Tag(props: { label: string }) {
  return (
    <span class="tag" style={{ padding: "2px 6px", color: "rgb(30, 30, 30)" }}>
      {props.label}
    </span>
  );
}
