import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function MyTasksRedirect({ params }: PageProps) {
  const { workspaceId } = await params;
  redirect(`/${workspaceId}/manage`);
}
