<script setup lang="ts">
import { corridor, prism, stack, threshold } from "@uxfront/scene/formations";
import { FRAMEWORKS } from "@uxfront/ui/frameworks";

import { DOCS_URL, GITHUB_URL, UXFRONT_URL } from "~/data/site";
import { hold, spotlight } from "~/lib/formations";

useUxHead({
  title: "Unframework - The compiler that speaks seven UI frameworks",
  description:
    "Write UI components once and compile them to native React, Vue, Svelte, Angular, Solid, Qwik and Astro. When a faster framework ships, you add a target, not a migration.",
  siteName: "Unframework",
  image: {
    path: "/og.jpg",
    width: 1200,
    height: 630,
    alt: "A beam of white light split by a prism into seven coloured rails, ending at Angular, Svelte, Astro, Vue, React, Solid and Qwik, beside the words: ready for the eighth, the compiler that speaks seven UI frameworks.",
  },
  sameAs: [GITHUB_URL],
});

// The prism tells the story: one beam of light (your source) goes into the
// prism (the compiler) and comes out as seven rails (the frameworks). The hero
// shows all of it, the first two chapters close in on one part each, and in
// the third the rails become a stack of seven cards, one per framework. In the
// fourth, the rails pass through a film of light and become one white stream,
// whatever comes next.
const hero = hold(
  prism({
    key: "hero",
    label: "Unframework",
    views: {
      desktop: { target: [2.4, 0.2, 0], span: [4.4, 2.3], shift: [0.44, 0.06] },
      mobile: { shift: [0, 0.5] },
    },
  }),
  1,
);
const source = spotlight(
  hold(
    prism({
      key: "source",
      label: "Source",
      views: {
        desktop: { eye: [-2.4, 1.2, 7], target: [-2.6, 0, 0], span: [2.6, 1], shift: [0.3, 0] },
        mobile: { eye: [-2.2, 1, 7.5], target: [-2.4, 0, 0], span: [2.4, 1] },
      },
    }),
    1,
  ),
  -20,
  -0.6,
);
const compiler = spotlight(
  hold(
    prism({
      key: "compiler",
      label: "Compiler",
      views: {
        desktop: {
          eye: [1.8, 1.4, 5.5],
          target: [0.5, 0.2, 0],
          span: [1.8, 1.4],
          shift: [-0.34, 0],
        },
        mobile: { eye: [1.4, 1.2, 6], target: [0.4, 0.2, 0], span: [1.7, 1.4] },
      },
    }),
    1,
  ),
  -1.1,
  1,
  // The rails fan out behind the copy: keep them faint so it stays legible.
  { soft: 0.6, dim: 0.02 },
);
// The cards are dealt one after another as the chapter is read, in step with
// the framework chips.
const output = stack({ key: "output", label: "Output" });
// The same seven beams of light cross a soap film into a faster medium, where
// they converge into one white stream: the next framework. They break through
// one after another as the chapter is read.
const next = threshold({ key: "next", label: "Next" });
const scene = [hero, source, compiler, output, next, corridor({ label: "Build on it" })];

const chapters = {
  source: { id: "source", index: "01", role: "Source", title: "Write it once" },
  compiler: { id: "compiler", index: "02", role: "Compiler", title: "Compile it to seven" },
  output: { id: "output", index: "03", role: "Output", title: "Ship it everywhere" },
  next: { id: "next", index: "04", role: "Next", title: "Take it to the next one" },
};

const nav = Object.values(chapters).map((chapter) => ({
  href: `#${chapter.id}`,
  label: chapter.role,
  index: chapter.index,
}));

const once = [
  { title: "One source", text: "No port per framework to write, review and keep in sync." },
  { title: "No drift", text: "Seven outputs can't fall out of step when there is only one input." },
  {
    title: "One standard",
    text: "Meet the Open Components standard once, and every output meets it.",
  },
  { title: "Agent-ready", text: "Agents change one component, not seven, so no port is missed." },
];

const compile = [
  { title: "Idiomatic", text: "Hooks in React, refs in Vue, runes in Svelte, signals in Solid." },
  { title: "Consistent", text: "Props, events and slots keep their names in every framework." },
  { title: "Build-time", text: "The translation happens in your build, not in the browser." },
  { title: "Deterministic", text: "The same source compiles to the same output, every time." },
];

const ahead = [
  {
    title: "No migration",
    text: "A new framework is a new compile target, not a rewrite of every component.",
  },
  {
    title: "No bet to make",
    text: "Don't guess which framework wins. Your components go where it goes.",
  },
  {
    title: "Side by side",
    text: "Ship the old framework and the new one from the same source while you move.",
  },
  {
    title: "On your schedule",
    text: "Switch when the numbers say so, not when a rewrite fits the roadmap.",
  },
];

const targets = FRAMEWORKS.map((framework, i) => ({
  label: framework,
  framework,
  tone: `var(--ux-spectrum-${i})`,
}));

const family = [
  {
    href: "https://opencomponents.dev",
    name: "Open Components",
    meta: "Standard",
  },
  {
    href: "https://styleframe.dev",
    name: "Styleframe",
    meta: "Styling engine",
  },
  {
    href: "https://inkline.io",
    name: "Inkline",
    meta: "UI library",
  },
  {
    href: UXFRONT_URL,
    name: "UXFront",
    meta: "Foundation",
  },
];
</script>

<template>
  <UxSite :scene="scene" skip-to="#source" skip-label="Skip to how it works">
    <template #anchors>
      <UxAnchor
        v-for="(framework, i) in FRAMEWORKS"
        :key="`hero-${framework}`"
        :anchor="`hero:${i}`"
        :label="framework"
      >
        <template #icon><UxFrameworkLogo :name="framework" /></template>
      </UxAnchor>
      <UxAnchor
        v-for="(framework, i) in FRAMEWORKS"
        :key="`output-${framework}`"
        :anchor="`output:${i}`"
        :label="framework"
      >
        <template #icon><UxFrameworkLogo :name="framework" /></template>
      </UxAnchor>
      <UxAnchor anchor="next:stream" label="The next framework">
        <template #icon>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke-dasharray="2.5 2" />
          </svg>
        </template>
      </UxAnchor>
    </template>
    <template #header>
      <UxHeader brand="Unframework" :nav="nav" nav-label="How it works" :github="GITHUB_URL">
        <template #mark />
        <template #brand>Unframework</template>
        <template #byline>
          by
          <a :href="UXFRONT_URL">
            <UxFrontMark />
            <span><strong>UX</strong>Front</span>
          </a>
        </template>
        <template #actions>
          <NuxtLink class="header-docs" :to="DOCS_URL">Documentation</NuxtLink>
        </template>
      </UxHeader>
    </template>

    <UxHero
      kicker="Ready for the eighth"
      title="The compiler that speaks seven UI frameworks"
      :index="nav"
      index-label="How it works"
      scroll-href="#source"
    >
      <template #lines>
        <UxHeroLine>The <strong>compiler</strong></UxHeroLine>
        <UxHeroLine>that speaks seven</UxHeroLine>
        <UxHeroLine>UI frameworks</UxHeroLine>
      </template>
      <template #lead>
        Write a component once. Unframework compiles it to native React, Vue, Svelte, Angular,
        Solid, Qwik and Astro code, and to whichever faster framework comes next, with no migration.
        <br />
        <UxPillLink class="hero-docs" :href="DOCS_URL" label="Read the documentation" />
      </template>
    </UxHero>

    <UxChapter v-bind="chapters.source" :steps="4">
      <template #lead>
        One component is the source of truth for every framework. Change it in one place, and all
        seven get the change on the next build.
      </template>
      <UxTraits :items="once" />
    </UxChapter>

    <UxChapter v-bind="chapters.compiler" :steps="4" align="end">
      <template #lead>
        The compiler reads what your component does, then writes it the way each framework expects:
        its reactivity, its templates, its conventions.
      </template>
      <UxTraits :items="compile" />
    </UxChapter>

    <UxChapter v-bind="chapters.output" :steps="7">
      <template #lead>
        Each framework gets a real component in its own format, typed and readable, with no wrapper
        or adapter in between.
      </template>
      <UxChips :items="targets" aria-label="Compile targets" />
    </UxChapter>

    <UxChapter v-bind="chapters.next" :steps="4" align="end">
      <template #lead>
        AI is speeding everything up, and a faster framework is always around the corner. When it
        lands, it's one more compile target: your components move on the next build, not in a
        migration.
      </template>
      <UxTraits :items="ahead" />
    </UxChapter>

    <UxFinale kicker="Part of UXFront" :cards="family">
      <template #title>Seven frameworks. And the <strong>next</strong>.</template>
      <template #lead>
        Write it once, and let the compiler speak every framework your users work in, including the
        one that isn't out yet.
      </template>
      <template #actions>
        <UxPillLink :href="DOCS_URL" label="Read the documentation" />
        <UxPillLink :href="GITHUB_URL" label="Follow on GitHub" />
      </template>
      <template #footer>
        <span>© 2026 UXFront</span>
        <a :href="GITHUB_URL">GitHub</a>
      </template>
    </UxFinale>
  </UxSite>
</template>

<style scoped>
/* The first frame only has the components' inline styles (Tailwind loads after
   it), so the docs links are styled here rather than with utilities. */
.hero-docs {
  margin-top: 2rem;
}

/* Phones can't fit the byline beside both header links. The hero links to the
   docs just below. */
@media (max-width: 639px) {
  .header-docs {
    display: none;
  }
}
</style>
