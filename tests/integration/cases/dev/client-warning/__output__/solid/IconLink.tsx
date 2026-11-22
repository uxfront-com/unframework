import { type ComponentProps, type JSX, onCleanup, onMount, splitProps } from "solid-js";
import { isDev } from "solid-js/web";

export default function IconLink(
  props: { href: string; label?: string } & Omit<
    ComponentProps<"a">,
    "href" | "label" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["href", "label"]);

  let link: HTMLAnchorElement | null = null;

  onMount(() => {
    if (isDev) {
      const name = link?.getAttribute("aria-label") ?? link?.textContent?.trim();
      if (!name) console.warn("IconLink has no accessible name: give it a `label` or some text.");
    }
  });

  return (
    <a
      ref={(element) => {
        link = element;
        onCleanup(() => {
          link = null;
        });
      }}
      href={props.href}
      aria-label={props.label}
      {...others}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M2 8h10M8 4l4 4-4 4" />
      </svg>
    </a>
  );
}
