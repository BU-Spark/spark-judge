export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="fi-loading" role="status" aria-live="polite">
      <div className="fi-loading-steps" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
      </div>
      <span className="fi-readout">{label}</span>
    </div>
  );
}
