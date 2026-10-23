import { type CSSProperties, type ClassList, component$, useConstant } from "@qwik.dev/core";

export interface WelcomeBannerProps {
  name: string;
}

const tips = ["Set up your profile", "Invite your team"];

export default component$<WelcomeBannerProps & { class?: ClassList; style?: CSSProperties }>(
  ({ name, class: className, style, ...attributes }) => {
    const greeting = useConstant(() => `Welcome, ${name}`);

    return (
      <section
        class={["welcome-banner", className]}
        aria-label="Welcome"
        {...scopeAttributes(attributes)}
        style={style}
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
