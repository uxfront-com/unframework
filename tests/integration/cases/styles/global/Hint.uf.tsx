// An unstyled child: only its parent's `:global()` rule reaches its highlight.
export default function Hint({ text }: { text: string }) {
  return (
    <p class="hint">
      Tip: <span class="uf-highlight">{text}</span>
    </p>
  );
}
