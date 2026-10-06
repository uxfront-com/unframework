import { Component, input } from "@angular/core";

export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

@Component({
  selector: "uf-message-list",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let messages = this.messages();
    @let archived = this.archived();
    @let emptyText = this.emptyText();
    <section class="message-list" aria-label="Messages">
      <h2>Inbox</h2>
      <ul>
        @for (message of messages; track message.id) {
          <li>{{ message.subject }}</li>
        }
      </ul>
      @if (messages.length === 0) {
        <p>{{ emptyText }}</p>
      }
      <h2>Archive</h2>
      <ul>
        @for (message of archived; track message.id) {
          <li>{{ message.subject }}</li>
        }
      </ul>
      @if (archived.length === 0) {
        <p>No archived messages.</p>
      } @else {
        <p>{{ archived.length }} archived</p>
      }
    </section>
  `,
})
export default class MessageList {
  readonly messages = input.required<InboxMessage[]>();
  readonly archived = input<InboxMessage[], InboxMessage[] | undefined>([], {
    transform: (value) => (value === undefined ? [] : value),
  });
  readonly emptyText = input<string, string | undefined>("Nothing here yet.", {
    transform: (value) => (value === undefined ? "Nothing here yet." : value),
  });
}
