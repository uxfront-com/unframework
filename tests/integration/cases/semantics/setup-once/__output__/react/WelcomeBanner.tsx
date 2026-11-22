import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useState } from "react";

export interface WelcomeBannerProps {
  name: string;
}

export interface WelcomeBannerAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
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
