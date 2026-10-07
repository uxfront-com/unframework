import { component$, useConstant } from "@qwik.dev/core";

export interface WelcomeBannerProps {
  name: string;
}

const tips = ["Set up your profile", "Invite your team"];

export default component$<WelcomeBannerProps>(({ name }) => {
  const greeting = useConstant(() => `Welcome, ${name}`);

  return (
    <section class="welcome-banner" aria-label="Welcome">
      <h2>{greeting}</h2>
      <p>Signed in as {name}</p>
      <ul>
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
});
