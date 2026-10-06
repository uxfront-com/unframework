import { component$ } from "@qwik.dev/core";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

export default component$<BannerProps>(({ message, tone, emphasis }) => {
  return (
    <div class={["banner", tone]} role="note">
      <p class={emphasis}>{message}</p>
      <p class={`banner-footer banner-footer-${tone}`}>Shown to every visitor.</p>
    </div>
  );
});
