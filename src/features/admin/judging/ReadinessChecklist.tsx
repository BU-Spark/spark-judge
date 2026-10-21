import type {
  ReadinessCheck,
  ReadinessFixTarget,
} from "../../../../shared/hackathonReadiness";

const STATUS_LABEL = { pass: "Ready", warn: "Check", fail: "Blocker" } as const;

export function ReadinessChecklist({
  checks,
  onFix,
}: {
  checks: ReadinessCheck[];
  onFix: (target: ReadinessFixTarget) => void;
}) {
  const order = { fail: 0, warn: 1, pass: 2 } as const;
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <ul className="admin-readiness">
      {sorted.map((check) => (
        <li key={check.id} data-status={check.status}>
          <span className="admin-readiness-status">{STATUS_LABEL[check.status]}</span>
          <div className="admin-readiness-body">
            <p className="admin-readiness-title">{check.title}</p>
            {check.detail && <p className="admin-readiness-detail">{check.detail}</p>}
            {check.items && check.items.length > 0 && (
              <p className="admin-readiness-items">
                {check.items.slice(0, 8).join(" · ")}
                {check.items.length > 8 && ` · and ${check.items.length - 8} more`}
              </p>
            )}
          </div>
          {check.fix && check.status !== "pass" && (
            <button
              type="button"
              className="fi-key admin-readiness-fix"
              onClick={() => onFix(check.fix!.target)}
            >
              {check.fix.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
