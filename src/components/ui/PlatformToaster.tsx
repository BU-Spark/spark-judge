import { Toaster } from "sonner";

export function PlatformToaster() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{ className: "platform-toast" }}
    />
  );
}
