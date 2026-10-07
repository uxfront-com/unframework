import { useState } from "react";

export interface WelcomeBannerProps {
  name: string;
}

const tips = ["Set up your profile", "Invite your team"];

export default function WelcomeBanner({ name }: WelcomeBannerProps) {
  const [greeting] = useState(`Welcome, ${name}`);

  return (
    <section className="welcome-banner" aria-label="Welcome">
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
