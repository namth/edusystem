import { evaluateWritingSubmission } from "@/lib/ai-engine";

export async function gradeOpenAnswer(input: {
  category: string;
  prompt: string;
  answer: string;
  sample_answer?: string | null;
}): Promise<number> {
  const answer = (input.answer || "").trim();
  if (!answer) {
    return 0;
  }

  const promptWithSample = input.sample_answer
    ? `${input.prompt || ""}\nĐáp án tham khảo: ${input.sample_answer}`
    : input.prompt || "";

  const evalResult = await evaluateWritingSubmission(answer, promptWithSample);
  const score = typeof evalResult?.overallScore === "number" ? evalResult.overallScore : 0;
  return Math.max(0, Math.min(9, score));
}
