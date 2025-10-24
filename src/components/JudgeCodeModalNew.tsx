import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface JudgeCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: Id<"events">;
  onSuccess: () => void;
}

export function JudgeCodeModal({ isOpen, onClose, eventId, onSuccess }: JudgeCodeModalProps) {
  const [judgeCode, setJudgeCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const verifyCode = useMutation(api.events.verifyJudgeCodeAndStartJudging);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!judgeCode.trim()) {
      setError("Please enter a judge code");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await verifyCode({ eventId, judgeCode: judgeCode.trim() });
      toast.success("Code verified! Starting judging...");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Invalid code");
      toast.error("Invalid judge code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setJudgeCode("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-background rounded-2xl p-8 max-w-md w-full shadow-2xl slide-up border border-border">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-2xl font-heading font-bold mb-2 text-foreground">Enter Judge Code</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Please enter the judge code to start scoring teams for this event.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="judgeCode" className="block text-sm font-medium mb-2">
              Judge Code
            </label>
            <input
              id="judgeCode"
              type="text"
              value={judgeCode}
              onChange={(e) => {
                setJudgeCode(e.target.value);
                setError("");
              }}
              placeholder="Enter code..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Verifying...
              </span>
            ) : (
              "Verify & Start Judging"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}




