export default function Badge({
  text,
  tone = "info",
}: {
  text: string;
  tone?: "info" | "warn" | "error";
}) {
  return (
    <b data-badge={text} data-tone={tone}>
      {text}
    </b>
  );
}
