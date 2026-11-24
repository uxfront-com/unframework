import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type Signal,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import { isDev } from "@qwik.dev/core/build";

export default component$<
  { href: string; label?: string } & Omit<
    PropsOf<"a">,
    "href" | "label" | "class" | "style" | "ref"
  > & { class?: ClassList; style?: CSSProperties; ref?: Signal<Element | undefined> }
>(({ href, label, class: className, style, ref, ...attributes }) => {
  const link = useSignal<HTMLAnchorElement>();

  useVisibleTask$(
    () => {
      if (isDev) {
        const name = link.value?.getAttribute("aria-label") ?? link.value?.textContent?.trim();
        if (!name) console.warn("IconLink has no accessible name: give it a `label` or some text.");
      }
    },
    { strategy: "document-ready" },
  );

  return (
    <a
      ref={(element) => {
        link.value = element;
        if (ref) ref.value = element;
      }}
      href={href}
      aria-label={label}
      class={className}
      style={style}
      {...attributes}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M2 8h10M8 4l4 4-4 4" />
      </svg>
    </a>
  );
});
