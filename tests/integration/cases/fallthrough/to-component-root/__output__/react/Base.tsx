export default function Base({ text }: { text: string }) {
  return (
    <button type="button" className="base">
      {text}
    </button>
  );
}
