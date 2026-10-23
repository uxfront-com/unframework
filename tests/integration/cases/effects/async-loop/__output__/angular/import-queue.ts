import {
  ApplicationRef,
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from "@angular/core";

export interface ImportQueueProps {
  files: string[];
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

@Component({
  selector: "uf-import-queue",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    @let attempts = this.attempts();
    <section
      class="import-queue"
      aria-label="Import"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <button type="button" (click)="importAll()">Import all</button>
      <p role="status">{{ status }}, {{ attempts }} attempts</p>
    </section>
  `,
})
export default class ImportQueue implements OnInit {
  readonly files = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufProgress = output<[status: string, attempts: number]>();
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  protected readonly status = signal("idle");
  protected readonly attempts = signal(0);

  ngOnInit(): void {
    const currentValues = computed(
      () => [this.status(), this.attempts()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues = currentValues();
    effect(
      () => {
        const current = currentValues();
        if (Object.is(current, lastValues)) return;
        const [nextStatus, nextAttempts] = current;
        lastValues = current;
        untracked(() => {
          this.ufProgress.emit([nextStatus, nextAttempts]);
        });
      },
      { injector: this.injector },
    );
  }

  protected async importAll() {
    this.status.set("starting");
    for (const file of this.files()) {
      this.attempts.update((attempts) => attempts + 1);
      await this.nextTick();
      this.status.set(`imported ${file}`);
    }
    this.status.set("done");
  }

  private async nextTick(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
