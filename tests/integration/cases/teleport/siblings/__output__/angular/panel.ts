import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  ApplicationRef,
  Component,
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  type EmbeddedViewRef,
  type OnInit,
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
