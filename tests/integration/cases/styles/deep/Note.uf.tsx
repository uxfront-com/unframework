// An unstyled child: only its parent's `:deep()` rule reaches its paragraph.
export default function Note({ text }: { text: string }) {
  return (
    <div class="note-box">
      <p class="note">{text}</p>
    </div>
  );
}
