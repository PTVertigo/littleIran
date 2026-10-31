// REQ-4.4.4 loading feedback; screen readers hear the label through the status role
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
