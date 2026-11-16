<script setup lang="ts">
// A copy of Docus's own (docus/app/components/docs/DocsPageHeaderLinks.vue, 5.13)
// that names the button opening the "Copy page" menu, an icon with no text, which
// Docus renders without a name. Docus's menu button can't be reached from a
// wrapper, so the component is copied whole. Its @vueuse/core and ufo imports
// don't resolve from this app, so `copy` and the URL joins are written out here,
// with the same results. Compare it with Docus's when Docus is updated.
const route = useRoute();
const toast = useToast();
const runtimeConfig = useRuntimeConfig();
const appBaseURL = runtimeConfig.app?.baseURL || "/";
const mcpRoute = (runtimeConfig.public.mcp as { route?: string } | undefined)?.route || "/mcp";

const { t } = useDocusI18n();

// useClipboard() from @vueuse/core: `copied` shows for 1.5 seconds after a copy.
const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
async function copy(text: string) {
  await navigator.clipboard.writeText(text);
  copied.value = true;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (copied.value = false), 1500);
}

// withTrailingSlash() and joinURL() from ufo.
const base = appBaseURL.endsWith("/") ? appBaseURL : `${appBaseURL}/`;
const mcpPath = `${base}${mcpRoute.replace(/^\/+/, "")}`;

const markdownLink = computed(() => `${window?.location?.origin}${base}raw${route.path}.md`);
const mcpServerUrl = computed(() => `${window?.location?.origin}${mcpPath}`);
const mcpDeeplink = computed(
  () => `${window?.location?.origin}${mcpPath.replace(/\/+$/, "")}/deeplink`,
);
const items = computed(() => [
  [
    {
      label: t("docs.copy.link"),
      icon: "i-lucide-link",
      onSelect() {
        copy(markdownLink.value);
      },
    },
    {
      label: t("docs.copy.view"),
      icon: "i-simple-icons:markdown",
      target: "_blank",
      to: markdownLink.value,
    },
    {
      label: t("docs.copy.gpt"),
      icon: "i-simple-icons:openai",
      target: "_blank",
      to: `https://chatgpt.com/?hints=search&q=${encodeURIComponent(`Read ${markdownLink.value} so I can ask questions about it.`)}`,
    },
    {
      label: t("docs.copy.claude"),
      icon: "i-simple-icons:anthropic",
      target: "_blank",
      to: `https://claude.ai/new?q=${encodeURIComponent(`Read ${markdownLink.value} so I can ask questions about it.`)}`,
    },
  ],
  [
    {
      label: "Copy MCP Server URL",
      icon: "i-lucide-link",
      onSelect() {
        copy(mcpServerUrl.value);
        toast.add({
          title: "Copied to clipboard",
          icon: "i-lucide-check-circle",
        });
      },
    },
    {
      label: "Add MCP Server",
      icon: "i-simple-icons:cursor",
      target: "_blank",
      to: mcpDeeplink.value,
    },
  ],
]);

async function copyPage() {
  const page = await $fetch<string>(`/raw${route.path}.md`);
  copy(page);
}
</script>

<template>
  <UFieldGroup size="sm">
    <UButton
      :label="t('docs.copy.page')"
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      color="neutral"
      variant="soft"
      :ui="{
        leadingIcon: 'text-neutral size-3.5',
      }"
      @click="copyPage"
    />

    <UDropdownMenu
      size="sm"
      :items="items"
      :content="{
        align: 'end',
        side: 'bottom',
        sideOffset: 8,
      }"
    >
      <UButton
        icon="i-lucide-chevron-down"
        color="neutral"
        variant="soft"
        class="border-l border-muted"
        aria-label="More page actions"
      />
    </UDropdownMenu>
  </UFieldGroup>
</template>
