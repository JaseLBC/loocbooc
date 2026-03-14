/**
 * /manufacturer root — redirects to /manufacturer/dashboard
 */

import { redirect } from "next/navigation";

export default function ManufacturerRootPage() {
  redirect("/manufacturer/dashboard");
}
