import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input as input_1,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface CommandMenuProps {
  commands: string[];
}

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input_1.required<HTMLElement>();
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
  selector: "uf-command-menu",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let commands = this.commands();
    @let active = this.active();
    <section
      class="command-menu"
      aria-label="Command menu"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <form role="search" aria-label="Commands">
        <label>Command<input
          name="command"
          (input)="onCommandInput($event)"
          (keydown)="handleKey($event)"
        /></label>
      </form>
      <ul aria-label="Suggestions">
        @for (command of commands; track command; let index = $index) {
          <li [attr.aria-current]="index === active ? 'true' : undefined">{{ command }}</li>
        }
      </ul>
      <label>Shortcut name<input
        name="shortcut"
        #shortcutField
        (keydown)="onShortcutKeydown($event)"
      /></label>
    </section>
  `,
})
export default class CommandMenu {
  readonly commands = input_1.required<string[]>();
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  readonly run = output<string>();
  readonly dismiss = output<void>();
  private readonly shortcutField = viewChild<ElementRef<HTMLInputElement>>("shortcutField");
  protected readonly active = signal(0);
  private readonly query = signal("");

  protected handleKey(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "ArrowDown") {
      this.active.set((this.active() + 1) % this.commands().length);
    } else if (event.key === "ArrowUp") {
      this.active.set((this.active() + this.commands().length - 1) % this.commands().length);
    } else if (event.key === "Enter") {
      this.run.emit(this.commands()[this.active()] ?? this.query());
    } else if (event.key === "Escape") {
      this.active.set(0);
      this.dismiss.emit();
    }
  }

  private clearShortcut() {
    const input = this.shortcutField()?.nativeElement ?? null;
    if (input) input.value = "";
  }

  protected onCommandInput(event: InputEvent) {
    this.query.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onShortcutKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") this.clearShortcut();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
