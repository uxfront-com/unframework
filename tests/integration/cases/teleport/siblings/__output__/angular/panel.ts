import {
  Component,
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  inject,
  input,
  signal,
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
    const container = inject(ViewContainerRef);
    const document = inject(DOCUMENT);
    let nodes: Node[] = [];
    const mount = () => {
      const target = document.querySelector(this.ufTeleport());
      if (!target) return;
      const view = container.createEmbeddedView(template);
      view.detectChanges();
      nodes = view.rootNodes;
      target.append(...nodes);
    };
    // Angular runs a render's callbacks in no source order: each teleport queues itself, and the
    // first to write mounts them all in the order of their anchors.
    afterNextRender({
      earlyRead: () => {
        TeleportQueue.push({ anchor: container.element.nativeElement as Node, mount });
      },
      write: () => {
        const due = TeleportQueue.splice(0).sort((a, b) =>
          a.anchor.compareDocumentPosition(b.anchor) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        );
        for (const each of due) each.mount();
      },
    });
    inject(DestroyRef).onDestroy(() => {
      for (const node of nodes) node.parentNode?.removeChild(node);
    });
  }
}

@Component({
  selector: "uf-panel",
  imports: [ScopeAttributes, Teleport],
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
      [ufScope]="this.host"
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
