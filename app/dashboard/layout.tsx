import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - SprintiQ",
  description: "SprintiQ Dashboard page",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
