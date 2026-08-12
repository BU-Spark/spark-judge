type BrandMarkProps = {
  className?: string;
};

type BrandLogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img src="/hackjudge-mark.svg" className={className} alt="" aria-hidden="true" />
  );
}

export function BrandLogo({
  className,
  showWordmark = true,
}: BrandLogoProps) {
  return (
    <span className={className ? `fi-brand-logo ${className}` : "fi-brand-logo"}>
      <BrandMark className="fi-brand-mark" />
      {showWordmark && (
        <span className="fi-brand-wordmark">HackJudge</span>
      )}
    </span>
  );
}
