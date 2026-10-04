// UF3005 reserved-attribute: `slot` is template syntax in Svelte, Astro and Vue.
export default function Panel() {
  return (
    <section class="panel">
      <h2 slot="title">Settings</h2>
    </section>
  );
}
