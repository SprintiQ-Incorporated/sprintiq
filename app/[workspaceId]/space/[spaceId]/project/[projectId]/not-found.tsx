"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, FolderOpen } from "lucide-react";

export default function ProjectNotFound() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  return (
    <div className="flex min-h-screen items-center justify-center workspace-header-bg p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-orange-500" />
          </div>
          <CardTitle className="text-2xl">Project Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            This project may have been deleted or you don&apos;t have access to view it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button asChild>
              <Link href={`/${workspaceId}/portfolio`}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Back to Portfolio
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
