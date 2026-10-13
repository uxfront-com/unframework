import { component$ } from "@qwik.dev/core";

export default component$<{ tag: "h1" | "h2" | "h3"; text: string }>(({ tag, text }) => {
  const Tag = tag;

  return (
    <>
      <Tag class="heading">{text}</Tag>
    </>
  );
});
