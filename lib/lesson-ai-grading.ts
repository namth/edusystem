import { evaluateWritingSubmission, evaluateSpeakingWithAudio } from "@/lib/ai-engine";

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

  if (input.category && input.category.startsWith("SPEAKING_")) {
    const evalResult = await evaluateSpeakingWithAudio(answer, input.prompt || "");
    const score = typeof evalResult?.overallScore === "number" ? evalResult.overallScore : 0;
    return Math.max(0, Math.min(9, score));
  }

  const promptWithSample = input.sample_answer
    ? `${input.prompt || ""}\nĐáp án tham khảo: ${input.sample_answer}`
    : input.prompt || "";

  const evalResult = await evaluateWritingSubmission(answer, promptWithSample);
  const score = typeof evalResult?.overallScore === "number" ? evalResult.overallScore : 0;
  return Math.max(0, Math.min(9, score));
}
