import { Component, ElementRef, input as input_1, output, signal, viewChild } from "@angular/core";

export interface CommandMenuProps {
  commands: string[];
}

@Component({
  selector: "uf-command-menu",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let commands = this.commands();
    @let active = this.active();
    <section class="command-menu" aria-label="Command menu">
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
}
