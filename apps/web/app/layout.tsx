/**
 * Root layout — wraps every page on the site.
 * Provides: HTML structure, global styles, and Supabase auth context.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    template: "%s | Loocbooc",
    default: "Loocbooc — Fashion Industry OS",
  },
  description:
    "The platform where fashion is made. Back styles before they're produced. Try on anything. Connect with manufacturers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
