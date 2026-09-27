/** An empty screen is an invitation to act, not an error message. */
export function EmptyState({ title, body, action }: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{
        border: '1px dashed var(--line-strong)',
        borderRadius: 'var(--radius-m)',
        padding: 'var(--gap-xl) var(--gap-l)',
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}
    >
      <p style={{ margin: 0, color: 'var(--text)', fontWeight: 600 }}>{title}</p>
      <p style={{ margin: '6px auto 0', maxWidth: '38ch' }}>{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: 'var(--gap-l)',
            minHeight: 'var(--tap)',
            padding: '0 18px',
            borderRadius: 'var(--radius-s)',
            border: 'none',
            background: 'var(--text)',
            color: 'var(--surface)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
