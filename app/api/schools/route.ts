import { publicSchoolDirectory } from "@/lib/schools";

export async function GET() {
  return Response.json(
    { schemaVersion: 1, schools: publicSchoolDirectory() },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
