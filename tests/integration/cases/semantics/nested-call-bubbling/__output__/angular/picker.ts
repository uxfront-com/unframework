import {
  ApplicationRef,
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

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
  selector: "uf-picker",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let status = this.status();
    <section
      class="picker"
      aria-label="Picker"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <div class="choices" role="presentation" (click)="report()">
        <button type="button" (click)="pick('alpha')">Alpha</button>
        <button type="button" (click)="pick('beta')">Beta</button>
      </div>
      <ol aria-label="Log">
        @for (entry of log; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
      <p role="status">{{ status }}</p>
      <button type="button" (click)="start()">Start</button>
    </section>
  `,
})
export default class Picker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly done = output<[step: number, status: string]>();
  private readonly appRef = inject(ApplicationRef);
  private readonly selected = signal("none");
  private readonly hits = signal(0);
  protected readonly log = signal<string[]>([]);
  protected readonly status = signal("idle");
  private readonly step = signal(0);

  private record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected pick(name: string) {
    this.selected.set(name);
    this.hits.update((hits) => hits + 1);
  }

  protected report() {
    this.record(`picked ${this.selected()} #${this.hits()}`);
  }

  private async load() {
    this.status.set("loading");
    await Promise.resolve();
    this.step.update((step) => step + 1);
  }

  private async run() {
    this.step.update((step) => step + 1);
    await this.load();
    this.status.set(`loaded ${this.step()}`);
    await this.nextTick();
    this.done.emit([this.step(), this.status()]);
  }

  protected start() {
    void this.run();
    this.status.set("started");
  }

  private async nextTick(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
