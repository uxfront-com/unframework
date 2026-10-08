// UF3047 unknown-component: a PascalCase tag names an imported component or one of the module's;
// `Header` is misspelt `Haeder`.
function Header() {
  return <header class="header">Site</header>;
}

export default function Page() {
  return (
    <div class="page">
      <Haeder />
      <p>Content</p>
    </div>
  );
}
