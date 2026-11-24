import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

export default component$<
  BannerProps &
    Omit<PropsOf<"div">, "message" | "tone" | "emphasis" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ message, tone, emphasis, class: className, style, ...attributes }) => {
  return (
    <div class={["banner", tone, className]} role="note" style={style} {...attributes}>
      <p class={emphasis}>{message}</p>
      <p class={`banner-footer banner-footer-${tone}`}>Shown to every visitor.</p>
    </div>
  );
});
