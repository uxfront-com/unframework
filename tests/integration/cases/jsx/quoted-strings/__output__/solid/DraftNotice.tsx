export interface DraftNoticeProps {
  author: string;
  saved: boolean;
}

export default function DraftNotice(props: DraftNoticeProps) {
  return (
    <section class="draft-notice" aria-label="Draft">
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23345'/%3E%3C/svg%3E"
        alt={`${props.author}'s avatar`}
        width="32"
        height="32"
      />
      <p title={props.saved ? "Saved" : "Don't forget to save"}>
        {props.saved ? "Saved" : 'Not "saved" yet'}
      </p>
      <p title={props.saved ? "Nothing to save" : `Press "Save" to keep ${props.author}'s changes`}>
        {props.saved
          ? `${props.author}'s draft is safe.`
          : `${props.author} says: "I'll save it later."`}
      </p>
    </section>
  );
}
