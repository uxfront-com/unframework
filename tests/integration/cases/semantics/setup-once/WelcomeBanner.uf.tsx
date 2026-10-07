export interface WelcomeBannerProps {
  name: string;
}

export default function WelcomeBanner({ name }: WelcomeBannerProps) {
  const greeting = `Welcome, ${name}`;
  const tips = ["Set up your profile", "Invite your team"];

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
}
