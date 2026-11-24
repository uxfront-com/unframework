import { clearedRef } from "./_unframework/clearedRef";
import { type ComponentProps, type JSX, isDev } from "@solidjs/web";
import { omit, onSettled } from "solid-js";

export default function IconLink(
  props: { href: string; label?: string } & Omit<
    ComponentProps<"a">,
    "href" | "label" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "href", "label");

  let link: HTMLAnchorElement | null = null;

  onSettled(() => {
    if (isDev) {
      const name = link?.getAttribute("aria-label") ?? link?.textContent?.trim();
      if (!name) console.warn("IconLink has no accessible name: give it a `label` or some text.");
    }
  });

  return (
    <a
      ref={clearedRef(
        (element) => {
          link = element;
        },
        () => {
          link = null;
        },
      )}
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
