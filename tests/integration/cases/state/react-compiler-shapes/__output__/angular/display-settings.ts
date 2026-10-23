import {
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

export interface Settings {
  theme: string;
  size: number;
}

interface SaveReply {
  id?: number;
  error?: string;
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
  selector: "uf-display-settings",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let settings = this.settings();
    @let saving = this.saving();
    @let label = this.label();
    @let failure = this.failure();
    <section
      class="display-settings"
      aria-label="Display"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">Theme {{ settings.theme }}, size {{ settings.size }}</p>
      <button type="button" (click)="onDark()">Dark</button>
      <button type="button" (click)="grow()">Larger</button>
      <button type="button" (click)="onAllowUpTo30()">Allow up to 30</button>
      <button type="button" (click)="save()">Save</button>
      <p>{{ saving ? "Saving" : failure === "" ? label : "Failed: " + failure }}</p>
      <div role="group" aria-label="Server">
        <button type="button" (click)="onReplyWithAnId()">Reply with an id</button>
        <button type="button" (click)="onReplyAsADraft()">Reply as a draft</button>
        <button type="button" (click)="onReplyWithAnError()">Reply with an error</button>
      </div>
    </section>
  `,
})
export default class DisplaySettings {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly applied = output<[theme: string, size: number]>();
  readonly saved = output<number>();
  protected readonly settings = signal<Settings>({ theme: "light", size: 14 });
  private readonly maxSize = signal(20);
  protected readonly saving = signal(false);
  protected readonly label = signal("Never saved");
  protected readonly failure = signal("");
  private finish: ((reply: SaveReply) => void) | undefined;

  private apply(patch: Partial<Settings>) {
    const { theme = this.settings().theme, size = this.settings().size } = patch;
    this.settings.set({ theme, size });
    this.applied.emit([theme, size]);
  }

  protected grow() {
    const clamp = (value: number, max = this.maxSize()) => Math.min(value, max);
    this.apply({ size: clamp(this.settings().size + 4) });
  }

  protected async save() {
    this.saving.set(true);
    this.failure.set("");
    try {
      const reply = await new Promise<SaveReply>((resolve) => {
        this.finish = resolve;
      });
      if (reply.error) throw new Error(reply.error);
      const id = reply.id ?? 0;
      this.label.set(id === 0 ? "Saved as a draft" : `Saved as #${id}`);
      this.saved.emit(id);
    } catch (error) {
      this.failure.set(error instanceof Error ? error.message : "Saving failed");
    } finally {
      this.saving.set(false);
    }
  }

  protected onDark() {
    this.apply({ theme: "dark" });
  }

  protected onAllowUpTo30() {
    this.maxSize.set(30);
  }

  protected onReplyWithAnId() {
    this.finish?.({ id: 7 });
  }

  protected onReplyAsADraft() {
    this.finish?.({});
  }

  protected onReplyWithAnError() {
    this.finish?.({ error: "Disk full" });
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
