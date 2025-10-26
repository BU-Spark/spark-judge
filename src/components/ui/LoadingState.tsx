export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex justify-center items-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-10 h-10 border-[3px] border-primary/50 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
