import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import ConfirmDialog from "./confirm-dialog";
import { isPlatformBrowser } from "@angular/common";
import {
  ApplicationRef,
  Component,
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  type EmbeddedViewRef,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  TemplateRef,
  afterEveryRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface FilesProps {
  file: string;
}

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
}

/** The teleports a render created, which mount in the document's order. */
const TeleportQueue: { anchor: Node; mount: () => void }[] = [];

/** Mounts its template's content into the element `ufTeleport` selects once rendered, and removes it on destroy. */
@Directive({ selector: "ng-template[ufTeleport]" })
export class Teleport implements OnInit {
  readonly ufTeleport = input.required<string>();
  readonly ufTeleportHost = input<HTMLElement>();
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufTeleportHost();
    for (const name of host?.getAttributeNames() ?? []) {
      if (name.startsWith("data-uf-")) this.renderer.removeAttribute(host, name);
    }
  }

  constructor() {
    const template = inject<TemplateRef<unknown>>(TemplateRef);
    const application = inject(ApplicationRef);
    const document = inject(DOCUMENT);
    const anchor: Node = inject<ElementRef<Comment>>(ElementRef).nativeElement;
    let view: EmbeddedViewRef<unknown> | undefined;
    const mount = () => {
      const target = document.querySelector(this.ufTeleport());
      if (!target) return;
      view = template.createEmbeddedView({});
      application.attachView(view);
      view.detectChanges();
      target.append(...view.rootNodes);
    };
    const unmount = () => {
      const nodes: Node[] = view?.rootNodes ?? [];
      view?.destroy();
      view = undefined;
      for (const node of nodes) node.parentNode?.removeChild(node);
    };
    // Angular runs a render's callbacks in no source order: each teleport queues itself, and the
    // first to write mounts them all in the order of their anchors. A template projected into a
    // slot that isn't rendered has no anchor in the document, so it waits for one.
    afterEveryRender({
      earlyRead: () => {
        if (!view && anchor.isConnected) TeleportQueue.push({ anchor, mount });
      },
      write: () => {
        const due = TeleportQueue.splice(0).sort((a, b) =>
          a.anchor.compareDocumentPosition(b.anchor) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        );
        for (const each of due) each.mount();
        // The view reads the component's state, which this render may have changed.
        if (view && !anchor.isConnected) unmount();
        else view?.detectChanges();
      },
    });
    inject(DestroyRef).onDestroy(unmount);
  }
}

@Component({
  selector: "uf-files",
  imports: [ConfirmDialog, ScopeAttributes, Fallthrough, Teleport],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let file = this.file();
    @let open = this.open();
    <section
      class="files"
      aria-label="Files"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p>{{ file }}</p>
      <button type="button" (click)="onClick()">Delete {{ file }}</button>
      @if (open) {
        <ng-template ufTeleport="body">
          <div data-teleported="true" class="backdrop">
            <uf-confirm-dialog
              [title]="'Delete ' + file + '?'"
              (confirm)="confirm()"
              (ufClose)="onClose()"
            />
          </div>
        </ng-template>
      }
    </section>
  `,
})
export default class Files {
  readonly file = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly delete = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly open = signal(false);

  protected confirm() {
    this.open.set(false);
    this.delete.emit(this.file());
  }

  protected onClick() {
    this.open.set(true);
  }

  protected onClose() {
    this.open.set(false);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
