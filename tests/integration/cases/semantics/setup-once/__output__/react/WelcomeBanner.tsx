import { type ComponentPropsWithRef, useState } from "react";

export interface WelcomeBannerProps {
  name: string;
}

export type WelcomeBannerAttributes = Omit<ComponentPropsWithRef<"section">, "name" | "children">;

const tips = ["Set up your profile", "Invite your team"];

export default function WelcomeBanner({
  name,
  className,
  style,
  ...attributes
}: WelcomeBannerProps & WelcomeBannerAttributes) {
  const [greeting] = useState(`Welcome, ${name}`);

  return (
    <section
      className={cx("welcome-banner", className)}
      aria-label="Welcome"
      style={style}
      {...attributes}
    >
      <h2>{greeting}</h2>
      <p>Signed in as {name}</p>
      <ul>
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
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
