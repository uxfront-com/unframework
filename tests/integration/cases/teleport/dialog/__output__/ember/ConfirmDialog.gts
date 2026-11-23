import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying } from "@ember/destroyable";
import { capabilities, setModifierManager } from "@ember/modifier";
import { getOwner } from "@ember/owner";
import { renderSettled } from "@ember/renderer";
import type { ModifierLike } from "@glint/template";

export interface ConfirmDialogProps {
  title: string;
}

export interface ConfirmDialogEvents {
  onConfirm?: () => void;
  onClose?: () => void;
}

export interface ConfirmDialogSignature {
  Args: ConfirmDialogProps & { style?: unknown } & ConfirmDialogEvents;
  Element: HTMLElementTagNameMap["div"];
}

export default class ConfirmDialog extends Component<ConfirmDialogSignature> {
  onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.args.onClose?.();
  };

  readonly titleId = useId(this);

  @tracked cancel: HTMLButtonElement | null = null;

  #mounted = false;

  /** Called at the template's end: the hooks run once the component has rendered. */
  onMounted = (): undefined => {
    if (!this.#mounted) {
      this.#mounted = true;
      afterRender(this, () => {
        this.cancel?.focus();
      });
    }
    return undefined;
  };

  listener1 = () => this.args.onClose?.();

  listener2 = () => this.args.onConfirm?.();

  <template><div
      role="dialog"
      aria-modal="true"
      aria-labelledby={{this.titleId}}
      tabindex="-1"
      class="dialog"
      {{on "keydown" this.onKeydown}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><h2 id={{this.titleId}}>{{@title}}</h2><button
      type="button"
      {{templateRef this "cancel"}}
      {{on "click" this.listener1}}
    >Cancel</button><button type="button" {{on "click" this.listener2}}>Delete</button></div>{{(this.onMounted)}}</template>
}

/** Runs `run` once the render settles, unless its component is gone by then. */
function afterRender(owner: object, run: () => unknown): void {
  // A component on the server never mounts, as Vue registers no hook in a server render.
  if (import.meta.env.SSR) return;
  void renderSettled().then(() => {
    if (!isDestroying(owner)) void run();
  });
}

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}

/** A modifier that sets a member of its component to its element while the element is rendered. */
const templateRef = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: () => ({}),
    installModifier(
      _state: object,
      element: Element,
      { positional }: { positional: readonly unknown[] },
    ) {
      Reflect.set(positional[0] as object, positional[1] as string, element);
    },
    updateModifier() {},
    destroyModifier(_state: object, { positional }: { positional: readonly unknown[] }) {
      Reflect.set(positional[0] as object, positional[1] as string, null);
    },
  }),
  {},
) as unknown as ModifierLike<{
  Element: Element;
  Args: { Positional: [owner: object, name: string] };
}>;

/** How many ids each application gave, by its owner. */
const ids = new WeakMap<object, number>();

/**
 * Vue's `useId`: an id unique within the component's application. The server and the client
 * that hydrates its render create the components in the same order, so each gets the same id on
 * both, which a random id would not.
 */
function useId(component: object): string {
  const owner = getOwner(component) ?? component;
  const count = ids.get(owner) ?? 0;
  ids.set(owner, count + 1);
  return `uf-id-${count}`;
}
