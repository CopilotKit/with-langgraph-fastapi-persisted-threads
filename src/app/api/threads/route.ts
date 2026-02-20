import { listThreadIds } from "@/lib/checkpoint-db";

export async function GET() {
  const threadIds = await listThreadIds();
  return Response.json(threadIds);
}
