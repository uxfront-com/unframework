import {
  ApplicationRef,
  Component,
  ElementRef,
  Injector,
  type OnInit,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

interface Waiting {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

export interface SyncDeskProps {
  files: string[];
}

@Component({
  selector: "uf-sync-desk",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let email = this.email();
    @let checking = this.checking();
    @let valid = this.valid();
    @let step = this.step();
    @let owner = this.owner();
    @let editor = this.editor();
    @let error = this.error();
    @let saving = this.saving();
    @let status = this.status();
    @let imported = this.imported();
    @let note = this.note();
    @let sendBusy = this.sendBusy();
    @let outcome = this.outcome();
    @let level = this.level();
    <section class="sync-desk" aria-label="Sync desk">
      <button type="button" (click)="suggest()">Suggest</button>
      <button type="button" #confirm>Use this email</button>
      <p>{{ email }}: {{ checking ? "checking" : valid ? "valid" : "invalid" }}</p>
      <button type="button" (click)="load()">Load</button>
      <p>Step: {{ step }}, owner {{ owner }}, editor {{ editor }}</p>
      <label>Name<input name="name" (input)="onNameInput($event)" /></label>
      <button type="button" (click)="save()">Save</button>
      <p>{{ saving === "" ? error || "Not saving" : "Saving " + saving }}</p>
      <button type="button" (click)="importAll()">Import</button>
      <p>Import: {{ status }}, {{ imported }} imported</p>
      <button type="button" (click)="refresh()">Refresh</button>
      <button type="button" (click)="prefetch()">Prefetch</button>
      <p>Note: {{ note }}</p>
      <button type="button" (click)="send()">Send</button>
      <p>Send: {{ sendBusy ? "sending" : outcome === "" ? "not sent" : outcome }}</p>
      <button type="button" (click)="onLouder()">Louder</button>
      <p>Level: {{ level }}</p>
      <div role="group" aria-label="Server">
        <button type="button" (click)="answer('Ada')">Reply</button>
        <button type="button" (click)="answer('')">Decline</button>
        <button type="button" (click)="fail()">Fail</button>
      </div>
    </section>
  `,
})
export default class SyncDesk implements OnInit {
  readonly files = input.required<string[]>();
  readonly checked = output<string>();
  readonly summary = output<string>();
  readonly focused = output<string>();
  readonly progress = output<[step: string, owner: string]>();
  readonly saveState = output<[error: string, name: string]>();
  readonly savedName = output<string>();
  readonly importState = output<[status: string, count: number]>();
  readonly settled = output<string>();
  readonly sending = output<[busy: boolean, outcome: string]>();
  readonly sent = output<number>();
  readonly clamped = output<number>();
  private readonly confirm = viewChild<ElementRef<HTMLButtonElement>>("confirm");
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  private waiting: Waiting[] = [];
  protected readonly email = signal("ada@example.com");
  protected readonly checking = signal(false);
  protected readonly valid = signal(true);
  protected readonly step = signal("idle");
  protected readonly owner = signal("nobody");
  protected readonly editor = signal("nobody");
  private readonly name = signal("");
  protected readonly error = signal("");
  protected readonly saving = signal("");
  protected readonly status = signal("idle");
  protected readonly imported = signal(0);
  protected readonly note = signal("idle");
  protected readonly sendBusy = signal(false);
  protected readonly outcome = signal("");
  private readonly total = signal(0);
  private readonly volume = signal(4);
  protected readonly level = signal(4);

  constructor() {
    afterRenderEffect(() => {
      this.summary.emit(`${this.email()} is ${this.valid() ? "valid" : "invalid"}`);
    });
  }

  ngOnInit(): void {
    const currentEmail = computed(() => this.email());
    let lastEmail = currentEmail();
    effect(
      () => {
        const value = currentEmail();
        if (Object.is(value, lastEmail)) return;
        lastEmail = value;
        untracked(async () => {
          this.checking.set(true);
          const ok = await this.validate(value);
          this.checking.set(false);
          this.valid.set(ok);
        });
      },
      { injector: this.injector },
    );

    const currentEmail_1 = computed(() => this.email());
    let lastEmail_1 = currentEmail_1();
    afterRenderEffect(
      () => {
        const value = currentEmail_1();
        if (Object.is(value, lastEmail_1)) return;
        lastEmail_1 = value;
        untracked(() => {
          this.checked.emit(value);
        });
      },
      { injector: this.injector },
    );

    const currentValues = computed(() => [this.step(), this.owner()] satisfies [unknown, unknown], {
      equal: (next, last) => next.every((value, index) => Object.is(value, last[index])),
    });
    let lastValues = currentValues();
    effect(
      () => {
        const current_1 = currentValues();
        if (Object.is(current_1, lastValues)) return;
        const [current, who] = current_1;
        lastValues = current_1;
        untracked(() => {
          this.progress.emit([current, who]);
        });
      },
      { injector: this.injector },
    );

    const currentValues_1 = computed(
      () => [this.error(), this.saving()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues_1 = currentValues_1();
    effect(
      () => {
        const current_1 = currentValues_1();
        if (Object.is(current_1, lastValues_1)) return;
        const [message, current] = current_1;
        lastValues_1 = current_1;
        untracked(() => {
          this.saveState.emit([message, current]);
        });
      },
      { injector: this.injector },
    );

    const currentValues_2 = computed(
      () => [this.status(), this.imported()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues_2 = currentValues_2();
    effect(
      () => {
        const current = currentValues_2();
        if (Object.is(current, lastValues_2)) return;
        const [text, count] = current;
        lastValues_2 = current;
        untracked(() => {
          this.importState.emit([text, count]);
        });
      },
      { injector: this.injector },
    );

    const currentValues_3 = computed(
      () => [this.sendBusy(), this.outcome()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues_3 = currentValues_3();
    effect(
      () => {
        const current = currentValues_3();
        if (Object.is(current, lastValues_3)) return;
        const [sendingNow, text] = current;
        lastValues_3 = current;
        untracked(() => {
          this.sending.emit([sendingNow, text]);
        });
      },
      { injector: this.injector },
    );

    const currentVolume = computed(() => this.volume());
    let lastVolume = currentVolume();
    effect(
      () => {
        const next = currentVolume();
        if (Object.is(next, lastVolume)) return;
        lastVolume = next;
        untracked(() => {
          this.apply(next * 2);
        });
      },
      { injector: this.injector },
    );
  }

  private ask(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.waiting = [...this.waiting, { resolve, reject }];
    });
  }

  protected answer(text: string) {
    const [first, ...rest] = this.waiting;
    this.waiting = rest;
    first?.resolve(text);
  }

  protected fail() {
    const [first, ...rest] = this.waiting;
    this.waiting = rest;
    first?.reject(new Error("offline"));
  }

  private async validate(value: string): Promise<boolean> {
    return value.includes("@");
  }

  protected async suggest() {
    this.email.set("ada@lovelace.dev");
    await this.nextTick();
    this.confirm()?.nativeElement.focus();
    this.focused.emit(document.activeElement?.textContent ?? "none");
  }

  protected async load() {
    this.step.set("owner");
    this.owner.set(await this.ask());
    this.step.set("editor");
    this.editor.set(await this.ask());
    this.step.set("done");
  }

  private async persist(value: string) {
    this.saving.set(value);
    await this.ask();
    this.saving.set("");
  }

  protected async save() {
    this.error.set("");
    const payload = this.name().trim();
    if (!payload) {
      this.error.set("Name required");
      return;
    }
    await this.persist(payload);
    this.savedName.emit(payload);
  }

  protected async importAll() {
    this.imported.set(0);
    this.status.set("starting");
    for (const file of this.files()) {
      this.status.set(`importing ${file}`);
      await this.ask();
      this.imported.update((imported) => imported + 1);
    }
    this.status.set("done");
  }

  protected refresh() {
    this.note.set("refreshing");
    void this.ask()
      .then((text) => {
        this.note.set(`refreshed by ${text}`);
      })
      .finally(() => {
        this.settled.emit(this.note());
      });
  }

  protected async prefetch() {
    const pending = this.ask();
    this.note.set("waiting");
    const text = await pending;
    this.note.set(`prefetched by ${text}`);
  }

  protected async send() {
    this.sendBusy.set(true);
    this.outcome.set("");
    try {
      const reply = await this.ask();
      if (reply === "") {
        this.outcome.set("Declined");
        this.sendBusy.set(false);
        return;
      }
      this.total.update((total) => total + 1);
    } catch (failure) {
      this.outcome.set(failure instanceof Error ? failure.message : "Failed");
      this.sendBusy.set(false);
      return;
    }
    this.sendBusy.set(false);
    this.outcome.set(`Sent ${this.total()}`);
    this.sent.emit(this.total());
  }

  private apply(value: number) {
    if (value > 10) value = 10;
    this.level.set(value);
    this.clamped.emit(value);
  }

  protected onNameInput(event: InputEvent) {
    this.name.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onLouder() {
    this.volume.update((volume) => volume + 3);
  }

  private async nextTick(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }
}
