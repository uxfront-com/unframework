export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

export default function Banner(props: BannerProps) {
  return (
    <div class={cx("banner", props.tone)} role="note">
      <p class={cx(props.emphasis)}>{props.message}</p>
      <p class={cx(`banner-footer banner-footer-${props.tone}`)}>Shown to every visitor.</p>
    </div>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
