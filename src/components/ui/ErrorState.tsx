import { Card, Button, Text, Title, Icon } from "@tremor/react";

interface ErrorStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({
  title = "Unable to load content",
  description = "Please try again or contact support if the issue persists.",
  actionLabel = "Retry",
  onAction,
}: ErrorStateProps) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <Title className="mb-2">{title}</Title>
        <Text className="mb-6">{description}</Text>
        {onAction && (
          <Button onClick={onAction} color="red" variant="secondary">
            {actionLabel}
          </Button>
        )}
      </Card>
    </div>
  );
}
