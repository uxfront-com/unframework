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
  signal,
  viewChild,
} from "@angular/core";

interface Row {
  id: number;
  label: string;
}

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
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
  selector: "uf-panel",
  imports: [ScopeAttributes, Fallthrough, Teleport],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let note = this.note();
    @let extras = this.extras();
    @let rows = this.rows();
    <section
      class="panel"
      aria-label="Panel"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" (click)="onShowNote()">Show note</button>
      <button type="button" (click)="addExtra()">Add extra</button>
      <button type="button" (click)="onReverseRows()">Reverse rows</button>
      @if (note) {
        <p class="note">Note</p>
      }
      @for (extra of extras; track extra) {
        <span>{{ extra }}</span>
      }
      <ng-template ufTeleport="body">
        <div data-teleported="true" class="first">First</div>
      </ng-template>
      <ng-template ufTeleport="body">
        <div data-teleported="true" class="second">Second</div>
      </ng-template>
      <ul>
        @for (row of rows; track row.id) {
          <li>{{ row.label }}<ng-template
            ufTeleport="body"
          ><p data-teleported="true" class="tip">{{ row.label }} tip</p></ng-template></li>
        }
      </ul>
    </section>
  `,
})
export default class Panel {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly note = signal(false);
  protected readonly extras = signal<string[]>([]);
  protected readonly rows = signal<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ]);

  protected addExtra() {
    this.extras.set([...this.extras(), `Extra ${this.extras().length + 1}`]);
  }

  protected onShowNote() {
    this.note.set(true);
  }

  protected onReverseRows() {
    this.rows.set([...this.rows()].reverse());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
