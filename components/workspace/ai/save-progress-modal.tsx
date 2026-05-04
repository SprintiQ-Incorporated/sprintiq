import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface SaveProgressModalProps {
  isOpen: boolean;
  currentStep: string;
  progress: number;
}

export default function SaveProgressModal({
  isOpen,
  currentStep,
  progress,
}: SaveProgressModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="sr-only">Save Progress</DialogTitle>
        <DialogDescription className="sr-only">
          Progress indicator for saving generated content to your workspace
        </DialogDescription>
        <div className="flex flex-col items-center justify-center space-y-4 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <h3 className="text-lg font-semibold text-center">{currentStep}</h3>
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-muted-foreground text-center">
            {progress.toFixed(0)}% Complete
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
