import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  isVisible: boolean;
  currentStep: string;
  progress: number;
}

export function LoadingOverlay({
  isVisible,
  currentStep,
  progress,
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
      <div className="bg-card p-8 rounded-lg shadow-lg max-w-md w-full space-y-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <h3 className="text-xl font-semibold text-center">{currentStep}</h3>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {progress}% Complete
          </p>
        </div>
      </div>
    </div>
  );
}
