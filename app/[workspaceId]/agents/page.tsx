import { redirect } from "next/navigation";

interface AgentsPageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function AgentsPage({ params }: AgentsPageProps) {
  const { workspaceId } = await params;
  redirect(`/${workspaceId}/home`);
}
