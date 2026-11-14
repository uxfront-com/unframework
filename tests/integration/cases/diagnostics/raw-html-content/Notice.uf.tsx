// UF3052 raw-html-content: `innerHTML` replaces the content of an element that has children too,
// and a void element or a text-only element holds no markup for it to set.
export interface NoticeProps {
  message: string;
}

export default function Notice({ message }: NoticeProps) {
  return (
    <section class="notice">
      <p innerHTML={message}>Loading…</p>
      <hr innerHTML={message} />
      <textarea innerHTML={message} />
    </section>
  );
}
