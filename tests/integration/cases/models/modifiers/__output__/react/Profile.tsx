import { useModelText } from "./_unframework/useModelText";
import { type ComponentPropsWithRef, useState } from "react";

export type ProfileAttributes = Omit<ComponentPropsWithRef<"form">, "children">;

export default function Profile({ className, style, ...attributes }: ProfileAttributes) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("Lisbon");
  const [weight, setWeight] = useState(0);
  const nameField = useModelText(name, setName, { trim: true });
  const cityField = useModelText(city, setCity, { lazy: true });
  const weightField = useModelText(weight, setWeight, { number: true });

  return (
    <form aria-label="Profile" className={className} style={style} {...attributes}>
      <label>
        Name <input {...nameField} />
      </label>
      <label>
        City <input {...cityField} />
      </label>
      <label>
        Weight <input {...weightField} />
      </label>
      <output>
        [{name}] from {city}, {weight + 1}
      </output>
    </form>
  );
}
