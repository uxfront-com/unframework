export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

export default function Banner({ message, tone, emphasis }: BannerProps) {
  return (
    <div className={cx("banner", tone)} role="note">
      <p className={cx(emphasis)}>{message}</p>
      <p className={cx(`banner-footer banner-footer-${tone}`)}>Shown to every visitor.</p>
    </div>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
