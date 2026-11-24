import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

export default function Banner(
  props: BannerProps &
    Omit<ComponentProps<"div">, "message" | "tone" | "emphasis" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["message", "tone", "emphasis", "class"]);

  return (
    <div class={cx("banner", props.tone, props.class)} role="note" {...others}>
      <p class={cx(props.emphasis)}>{props.message}</p>
      <p class={`banner-footer banner-footer-${props.tone}`}>Shown to every visitor.</p>
    </div>
  );
}
