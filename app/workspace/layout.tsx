import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace - SprintiQ",
  description: "SprintiQ Workspace page",
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
