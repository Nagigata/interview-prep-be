import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SubmissionsService {
  private readonly JUDGE0_URL =
    process.env.JUDGE0_URL || 'http://localhost:2358';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  private getLanguageId(language: string): number {
    const map: Record<string, number> = {
      python: 71, // Python (3.8.1)
      python3: 71, // Python (3.8.1)
      javascript: 63, // JavaScript (Node.js 12.14.0)
      typescript: 74, // TypeScript (3.7.4)
      cpp: 54, // C++ (GCC 9.2.0)
      java: 62, // Java (OpenJDK 13.0.1)
      c: 50, // C (GCC 9.2.0)
      csharp: 51, // C# (Mono 6.6.0.161)
      golang: 60, // Go (1.13.5)
      rust: 73, // Rust (1.40.0)
      php: 68, // PHP (7.4.1)
      ruby: 72, // Ruby (2.7.0)
      swift: 83, // Swift (5.2.3)
      kotlin: 78, // Kotlin (1.3.72)
    };
    const langKey = language.toLowerCase();
    return map[langKey] || 63;
  }

  async runCode(
    challengeId: string,
    userId: string,
    code: string,
    language: string,
  ) {
    const challenge = await this.prisma.challenge.findFirst({
      where: {
        id: challengeId,
        isActive: true,
        skill: { isActive: true },
      },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    const testCases = challenge.testCases as any[];
    if (!testCases || testCases.length === 0) {
      throw new InternalServerErrorException(
        'No test cases found for this challenge',
      );
    }

    // Run only the first test case for "Run" button
    const testCase = testCases[0];
    const result = await this.executeInJudge0(
      code,
      language,
      testCase.input,
      testCase.output,
    );

    return {
      testCaseResults: [result],
      allPassed: result.status.id === 3, // 3 is "Accepted"
    };
  }

  async submitCode(
    challengeId: string,
    userId: string,
    code: string,
    language: string,
  ) {
    const challenge = await this.prisma.challenge.findFirst({
      where: {
        id: challengeId,
        isActive: true,
        skill: { isActive: true },
      },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    const testCases = challenge.testCases as any[];
    const results = [];
    let allPassed = true;

    for (const testCase of testCases) {
      const result = await this.executeInJudge0(
        code,
        language,
        testCase.input,
        testCase.output,
      );
      results.push(result);
      if (result.status.id !== 3) {
        allPassed = false;
      }
    }

    // Record submission in DB
    const submission = await this.prisma.challengeSubmission.create({
      data: {
        challengeId,
        userId,
        code,
        language,
        status: allPassed ? 'ACCEPTED' : 'REJECTED',
        // Optional: save average runtime/memory
        runtime: results[0]?.time
          ? Math.round(parseFloat(results[0].time) * 1000)
          : null,
        memory: results[0]?.memory || null,
      },
    });

    return {
      submissionId: submission.id,
      testCaseResults: results,
      allPassed,
    };
  }

  private async executeInJudge0(
    sourceCode: string,
    language: string,
    stdin: string,
    expectedOutput: string,
  ) {
    try {
      const languageId = this.getLanguageId(language);

      // 1. Create submission - Removal of wait=true to prevent socket hang up
      const createRes = await firstValueFrom(
        this.httpService.post(
          `${this.JUDGE0_URL}/submissions?base64_encoded=false`,
          {
            source_code: sourceCode,
            language_id: languageId,
            stdin: stdin,
            expected_output: expectedOutput,
          },
        ),
      );

      const token = createRes.data.token;

      // 2. Poll for result - Initialize with "Processing" status to enter the loop
      let result: any = { status: { id: 1 } };
      let retries = 0;

      while (result.status?.id <= 2 && retries < 15) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const pollRes = await firstValueFrom(
          this.httpService.get(
            `${this.JUDGE0_URL}/submissions/${token}?base64_encoded=false`,
          ),
        );
        result = pollRes.data;
        retries++;
      }

      return result;
    } catch (error) {
      if (error.response) {
        console.error(
          'Judge0 Response Error:',
          JSON.stringify(error.response.data, null, 2),
        );
      } else {
        console.error('Judge0 Connection Error:', error.message);
      }
      throw new InternalServerErrorException(
        `Judge0 Execution Error: ${error.message}`,
      );
    }
  }
}
