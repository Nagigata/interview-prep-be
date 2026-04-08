import { Injectable, Logger } from '@nestjs/common';
import { generateText, generateObject } from 'ai';
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
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async generateInterviewQuestions(
    params: GenerateQuestionsParams,
  ): Promise<string[]> {
    const { role, level, type, techstack, amount } = params;

    const { text: questions } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.
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

  async generateFeedback(
    transcript: { role: string; content: string }[],
  ): Promise<FeedbackResult> {
    const formattedTranscript = transcript
      .map((sentence) => `- ${sentence.role}: ${sentence.content}\n`)
      .join('');

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: feedbackSchema,
      prompt: `
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
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
