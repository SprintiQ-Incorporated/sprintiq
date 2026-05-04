import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — SprintiQ Turbo",
  description: "Sign in to SprintiQ Turbo.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
