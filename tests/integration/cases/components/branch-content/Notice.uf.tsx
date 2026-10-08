export default function Notice({ text, tone }: { text: string; tone: "info" | "quiet" }) {
  return (
    <p role="status" class={["notice", tone]}>
      {text}
    </p>
  );
}
