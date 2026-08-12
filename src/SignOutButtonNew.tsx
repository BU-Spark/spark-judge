import { useAuthActions } from "@convex-dev/auth/react";

type SignOutButtonProps = {
  className?: string;
  onClick?: () => void;
};

export function SignOutButton({ className = "fi-key", onClick }: SignOutButtonProps) {
  const { signOut } = useAuthActions();

  return (
    <button
      onClick={() => {
        void signOut();
        onClick?.();
      }}
      className={className}
    >
      Sign Out
    </button>
  );
}
