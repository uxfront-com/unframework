<script setup lang="ts">
import { corridor, prism } from "@uxfront/scene/formations";
import { FRAMEWORKS } from "@uxfront/ui/frameworks";

import { GITHUB_URL, UXFRONT_URL } from "~/data/site";
import { hold, spotlight } from "~/lib/formations";

useUxHead({
  title: "Unframework - The compiler that speaks seven UI frameworks",
  description:
    "Write your UI components once, then compile them to native React, Vue, Svelte, Angular, Solid, Qwik and Astro components. One source, seven frameworks.",
  siteName: "Unframework",
  image: {
    path: "/og.jpg",
    width: 1200,
    height: 630,
    alt: "A beam of white light split by a prism into seven coloured rails, ending at Angular, Svelte, Astro, Vue, React, Solid and Qwik, beside the words: the compiler that speaks seven UI frameworks.",
  },
  sameAs: [GITHUB_URL],
});

// The prism tells the whole story: one beam of light (your source) goes into
// the prism (the compiler) and comes out as seven rails (the frameworks).
// The hero shows all of it, then each chapter closes in on one part.
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
// Not held: the rails grow one after another as the chapter is read, in step
// with the framework chips.
const output = spotlight(
  prism({
    key: "output",
    label: "Output",
  }),
  1,
  20,
);
const scene = [hero, source, compiler, output, corridor({ label: "Build on it" })];

const chapters = {
  source: { id: "source", index: "01", role: "Source", title: "Write it once" },
  compiler: { id: "compiler", index: "02", role: "Compiler", title: "Compile it to seven" },
  output: { id: "output", index: "03", role: "Output", title: "Ship it everywhere" },
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
    </template>
    <template #header>
      <UxHeader brand="Unframework" :nav="nav" nav-label="How it works" :github="GITHUB_URL">
        <template #mark />
        <template #brand><strong>Un</strong>framework</template>
        <template #byline>
          by
          <a :href="UXFRONT_URL">
            <UxFrontMark />
            <span><strong>UX</strong>Front</span>
          </a>
        </template>
      </UxHeader>
    </template>

    <UxHero
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
        Solid, Qwik and Astro code, so one source serves every framework.
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

    <UxChapter v-bind="chapters.output" :steps="7" valign="end">
      <template #lead>
        Each framework gets a real component in its own format, typed and readable, with no wrapper
        or adapter in between.
      </template>
      <UxChips :items="targets" aria-label="Compile targets" />
    </UxChapter>

    <UxFinale kicker="Part of UXFront" :cards="family">
      <template #title>One source. <strong>Seven</strong> frameworks.</template>
      <template #lead>
        Write it once, and let the compiler speak every framework your users work in.
      </template>
      <template #actions>
        <UxPillLink :href="GITHUB_URL" label="Follow on GitHub" />
      </template>
      <template #footer>
        <span>© 2026 UXFront</span>
        <a :href="GITHUB_URL">GitHub</a>
      </template>
    </UxFinale>
  </UxSite>
</template>
