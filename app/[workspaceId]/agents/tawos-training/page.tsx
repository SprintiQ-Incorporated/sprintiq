"use client";

import TAWOSTrainingInterface from "@/components/workspace/ai/tawos-training-interface";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TAWOSTrainingPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center border-b workspace-border p-3">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-md">Your Training Data</h1>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <TAWOSTrainingInterface />
      </div>
    </div>
  );
}
