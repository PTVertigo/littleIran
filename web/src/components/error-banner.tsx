// role="alert" makes screen readers announce the message as soon as it appears
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      {message}
    </div>
  );
}
