import { ApplicationRef, Component, inject, output, signal } from "@angular/core";

@Component({
  selector: "uf-picker",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let status = this.status();
    <section class="picker" aria-label="Picker">
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
}
