import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Access Denied - SprintiQ",
  description: "SprintiQ Access Denied page",
};

export default function AccessDeniedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
