import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stylist Portal | Loocbooc",
};

export default function StylistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
