import { teleport } from "./_unframework/teleport";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  Slot,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<
  { href?: string; label: string } & Omit<
    PropsOf<"a"> & PropsOf<"button">,
    "href" | "label" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ href, label, class: className, style, ...attributes }) => {
  const mounted = useSignal(false);
  useVisibleTask$(
    () => {
      mounted.value = true;
    },
    { strategy: "document-ready" },
  );

  const Tag = href ? "a" : "button";

  return (
    <>
      <Tag href={Tag === "a" ? href : undefined} class={className} style={style} {...attributes}>
        {label}
        {mounted.value && (
          <>
            {""}
            <p ref={teleport("body")} data-teleported="true" class="tip" role="note">
              <Slot>{label}</Slot>
            </p>
          </>
        )}
      </Tag>
    </>
  );
});
