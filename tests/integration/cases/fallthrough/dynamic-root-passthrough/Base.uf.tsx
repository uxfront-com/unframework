// Its root is a `<component is>` over tags: a link with an `href`, and a button without one. It
// declares no `id`, ARIA, `data-*` or `title`, no listener and exposes nothing, so a consumer's
// attributes, listeners and ref fall through to whichever tag renders (ADR-0122). Its own `title`
// gives way to a consumer's, and its own click listener runs before a consumer's.
export default function Base({
  href,
  disabled,
  text,
}: {
  href?: string;
  disabled?: boolean;
  text: string;
}) {
  // A consumer handles a click, as a router would: the link does not navigate.
  function press(event: MouseEvent) {
    event.preventDefault();
  }
  return (
    <component
      is={href ? "a" : "button"}
      href={href}
      disabled={disabled}
      class="base"
      title="Base"
      onClick={press}
    >
      {text}
    </component>
  );
}
