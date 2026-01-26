import { auth } from "@clerk/nextjs/server";
import RoutePageClient from "./RoutePageClient";

export default async function RouteDetail({ params }: { params: { id: string } }) {
  const { userId, orgRole } = await auth();
  const isAdmin = orgRole === "admin" || orgRole === "owner";

  return <RoutePageClient canReassign={isAdmin} />;
}
