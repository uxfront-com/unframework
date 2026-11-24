import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"article">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <article
      class={["profile", className]}
      aria-labelledby="profile-name"
      style={style}
      {...attributes}
    >
      <header class="profile-header">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23345'/%3E%3C/svg%3E"
          alt="Ada's avatar"
          width={48}
          height={48}
        />
        <h2 id="profile-name">Ada Lovelace</h2>
      </header>
      <p>
        Mathematician &amp; writer
        <br />
        of the first published program
      </p>
      <hr />
      <label for="profile-note">Note</label>
      <input id="profile-note" type="text" name="note" placeholder="Say hello" />
    </article>
  );
});
