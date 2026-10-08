import { ApplicationRef, Component, inject, output, signal } from "@angular/core";

@Component({
  selector: "uf-save-draft",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    <section class="save-draft" aria-label="Draft">
      <p role="status">{{ status }}</p>
      <button type="button" (click)="save()">Save the draft</button>
    </section>
  `,
})
export default class SaveDraft {
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
}
