import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

export default component$<BannerProps & { class?: ClassList; style?: CSSProperties }>(
  ({ message, tone, emphasis, class: className, style }) => {
    return (
      <div class={["banner", tone, className]} role="note" style={style}>
        <p class={emphasis}>{message}</p>
        <p class={`banner-footer banner-footer-${tone}`}>Shown to every visitor.</p>
      </div>
    );
  },
);
