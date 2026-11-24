import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useConstant,
} from "@qwik.dev/core";

export interface WelcomeBannerProps {
  name: string;
}

const tips = ["Set up your profile", "Invite your team"];

export default component$<
  WelcomeBannerProps &
    Omit<PropsOf<"section">, "name" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, class: className, style, ...attributes }) => {
  const greeting = useConstant(() => `Welcome, ${name}`);

  return (
    <section
      class={["welcome-banner", className]}
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
});
