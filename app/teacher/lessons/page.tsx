import { redirect } from "next/navigation";

export default function TeacherLessonsRedirectPage() {
  redirect("/teacher/library?tab=lessons");
}
