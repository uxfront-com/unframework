import { GITHUB_URL } from "./data/site";

export default defineAppConfig({
  // The docs' GitHub, "Edit this page" and "Report an issue" links. Docus reads
  // them from the git remote otherwise, which not every checkout has. The docs
  // live in apps/web/content/, not at the root.
  github: {
    url: GITHUB_URL,
    branch: "main",
    rootDir: "apps/web",
  },
  docsTheme: {
    // Signs the header's site name "by UXFront", like the homepage header. With
    // no wordmark, the name stays Docus's plain title, as the homepage writes it.
    byline: true,
    // The frameworks the docs' examples come in, in the order the Framework
    // select shows them. The first is the default, and a page that skips the
    // reader's framework (`::framework-switcher` in content) shows the first one
    // it has. `value` names each framework's slot.
    frameworks: [
      { value: "react", label: "React", icon: "i-simple-icons-react" },
      { value: "vue", label: "Vue", icon: "i-simple-icons-vuedotjs" },
      { value: "svelte", label: "Svelte", icon: "i-simple-icons-svelte" },
      { value: "angular", label: "Angular", icon: "i-simple-icons-angular" },
      { value: "solid", label: "Solid", icon: "i-simple-icons-solid" },
      { value: "qwik", label: "Qwik", icon: "i-simple-icons-qwik" },
      { value: "astro", label: "Astro", icon: "i-simple-icons-astro" },
    ],
  },
  ui: {
    colors: {
      // The violet at the end of the prism's spectrum (see app/app.css for its shades).
      primary: "violet",
      neutral: "zinc",
    },
  },
});
