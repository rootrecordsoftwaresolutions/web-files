interface Props {
  icon?: string;
  title: string;
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = "🌺", title, message, action }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden>
        {icon}
      </div>
      <h3 style={{ margin: "0 0 0.5rem", color: "var(--text)" }}>{title}</h3>
      <p style={{ margin: "0 0 1rem", lineHeight: 1.5 }}>{message}</p>
      {action}
    </div>
  );
}
