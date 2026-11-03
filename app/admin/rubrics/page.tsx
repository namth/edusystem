import { permanentRedirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ rubric?: string }>;
}) {
  const params = await searchParams;
  const rubricQuery = params?.rubric ? `&rubric=${encodeURIComponent(params.rubric)}` : "";
  permanentRedirect(`/admin/scoring-standards?tab=rubrics${rubricQuery}`);
}
