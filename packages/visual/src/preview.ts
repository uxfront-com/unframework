// A catalogue's preview: `renderToCanvas` on a target's mount adapter, in place of Storybook's HTML
// renderer, so a story renders through the code the specs mount with. No decorators, and no
// Storybook markup inside the component's root.
import type { MountAdapter, MountedComponent } from "@unframework/testing";

/** The attribute of the element a story without output shows its reason in. */
export const NO_OUTPUT_ATTRIBUTE = "data-uf-no-output";

/** The part of Storybook's render context a story reads. */
export interface StoryRenderContext {
  storyContext: {
    id: string;
    args: Record<string, unknown>;
    component?: unknown;
    parameters: { ufNoOutput?: string; ufRunner?: boolean };
  };
  showMain: () => void;
  forceRemount: boolean;
}

/** What `.storybook/preview.ts` exports. */
export interface VisualPreview {
  parameters: { layout: "fullscreen" };
  renderToCanvas: (
    context: StoryRenderContext,
    canvas: HTMLElement,
  ) => Promise<() => Promise<void>>;
}

/** The preview of a target, from its mount adapter. */
export function createPreview(mount: MountAdapter): VisualPreview {
  let mounted: { id: string; instance: MountedComponent } | undefined;

  const unmount = async (canvas: HTMLElement) => {
    const instance = mounted?.instance;
    mounted = undefined;
    try {
      await instance?.unmount();
    } finally {
      canvas.replaceChildren();
    }
  };

  return {
    parameters: { layout: "fullscreen" },
    renderToCanvas: async ({ storyContext, showMain, forceRemount }, canvas) => {
      const { id, args, component, parameters } = storyContext;
      const teardown = () => unmount(canvas);
      showMain();
      // The same story with new args, as the Controls panel or a driver updates them.
      if (mounted?.id === id && !forceRemount) {
        await mounted.instance.rerender(args);
        return teardown;
      }
      await unmount(canvas);
      if (parameters.ufRunner) return teardown;
      if (parameters.ufNoOutput !== undefined) {
        const reason = document.createElement("p");
        reason.setAttribute(NO_OUTPUT_ATTRIBUTE, "");
        reason.textContent = parameters.ufNoOutput;
        canvas.append(reason);
        return teardown;
      }
      mounted = { id, instance: await mount(component, canvas, { props: args }) };
      return teardown;
    },
  };
}
