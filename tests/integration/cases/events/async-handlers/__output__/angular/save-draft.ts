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
  selector: "uf-save-draft",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    <section
      class="save-draft"
      aria-label="Draft"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">{{ status }}</p>
      <button type="button" (click)="save()">Save the draft</button>
    </section>
  `,
})
export default class SaveDraft {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly saved = output<[attempt: number, status: string]>();
  private readonly appRef = inject(ApplicationRef);
  protected readonly status = signal("Not saved");
  private readonly attempts = signal(0);

  protected async save() {
    this.status.set("Saving");
    this.attempts.update((attempts) => attempts + 1);
    await Promise.resolve();
    this.status.set("Checking");
    await this.nextTick();
    this.status.set(`Saved, attempt ${this.attempts()}`);
    this.saved.emit([this.attempts(), this.status()]);
  }

  private async nextTick(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
