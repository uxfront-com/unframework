import { component$ } from "@qwik.dev/core";

export default component$<{ big: boolean; text: string }>(({ big, text }) => {
  const Tag = big ? "h2" : "h3";

  return (
    <>
      <Tag class="heading">{text}</Tag>
    </>
  );
});
