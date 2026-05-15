import { Injectable, Logger } from '@nestjs/common';
import { generateObject, generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const feedbackSchema = z.object({
  totalScore: z.number(),
  categoryScores: z.array(
    z.object({
      name: z.string(),
      score: z.number(),
      comment: z.string(),
    }),
  ),
  strengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  finalAssessment: z.string(),
});

export type FeedbackResult = z.infer<typeof feedbackSchema>;

interface GenerateQuestionsParams {
  role: string;
  level: string;
  type: string;
  techstack: string;
  amount: number;
  language?: string;
  provider?: string;
}

interface LocalQuestion {
  question: string;
  expectedAnswer?: string;
  category?: string;
  difficulty?: string;
}

interface LocalQuestionsResponse {
  questions?: LocalQuestion[];
  provider?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly questionProvider =
    process.env.AI_QUESTION_PROVIDER || 'gemini';
  private readonly localModelUrl =
    process.env.LOCAL_MODEL_URL || 'http://localhost:8001';
  private readonly localFallbackToGemini =
    process.env.AI_LOCAL_FALLBACK_TO_GEMINI !== 'false';

  async generateInterviewQuestions(
    params: GenerateQuestionsParams,
  ): Promise<string[]> {
    const provider = params.provider || this.questionProvider;

    if (provider === 'local-qwen') {
      try {
        return await this.generateInterviewQuestionsWithLocalQwen(params);
      } catch (error) {
        this.logger.error('Local Qwen question generation failed', error);

        if (!this.localFallbackToGemini) {
          throw error;
        }

        this.logger.warn('Falling back to Gemini question generation');
      }
    }

    return this.generateInterviewQuestionsWithGemini(params);
  }

  private async generateInterviewQuestionsWithGemini(
    params: GenerateQuestionsParams,
  ): Promise<string[]> {
    const { role, level, type, techstack, amount, language = 'en' } = params;
    const langInstruction = language === 'vi' ? 'Vietnamese' : 'English';

    const { text: questions } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.

        CRITICAL INSTRUCTION: The questions must be generated exclusively in ${langInstruction}.

        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
      `,
    });

    try {
      if (Array.isArray(questions)) return questions;
      if (typeof questions === 'object') return Object.values(questions);
      const cleaned = String(questions)
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return String(questions)
        .split('\n')
        .map((q: string) => q.trim())
        .filter((q: string) => q.length > 0);
    }
  }

  private async generateInterviewQuestionsWithLocalQwen(
    params: GenerateQuestionsParams,
  ): Promise<string[]> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.LOCAL_MODEL_TIMEOUT_MS || 120000),
    );

    try {
      const response = await fetch(
        `${this.localModelUrl.replace(/\/$/, '')}/generate-questions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...params,
            language: params.language || 'en',
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Local model server returned ${response.status}: ${detail}`,
        );
      }

      const data = (await response.json()) as LocalQuestionsResponse;
      const questions = data.questions
        ?.map((item) => item.question?.trim())
        .filter((question): question is string => Boolean(question));

      if (!questions?.length) {
        throw new Error('Local model server returned no valid questions.');
      }

      return questions.slice(0, params.amount);
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateFeedback(
    transcript: { role: string; content: string }[],
    language: string = 'en',
  ): Promise<FeedbackResult> {
    const formattedTranscript = transcript
      .map((sentence) => `- ${sentence.role}: ${sentence.content}\n`)
      .join('');

    const langInstruction = language === 'vi' ? 'Vietnamese' : 'English';

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: feedbackSchema,
      prompt: `
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.

        CRITICAL INSTRUCTION: Your feedback evaluation must be written exclusively in ${langInstruction}. The category names in the response must remain exactly as structurally required, but the comments, strengths, areasForImprovement, and finalAssessment must be in ${langInstruction}.

        TRANSCRIPT QUALITY INSTRUCTION: This transcript comes from a voice interview and may contain speech-to-text errors, fragmented sentences, repeated short turns, unclear pronunciation, filler words, or interrupted answers. Evaluate only the candidate's clearly expressed ideas. Do not invent missing details. Ignore greeting-only, closing-only, or obvious non-answer fragments. If an answer is unclear because of transcript quality, mention that as a communication or clarity issue instead of assuming the candidate knew the full answer.

        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem-Solving**: Ability to analyze problems and propose solutions.
        - **Cultural & Role Fit**: Alignment with company values and job role.
        - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.
      `,
      system:
        'You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories',
    });

    return object;
  }
}
