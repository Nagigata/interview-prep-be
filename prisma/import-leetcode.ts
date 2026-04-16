import { PrismaClient, Difficulty } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

const LEETCODE_JSON_PATH =
  'd:/DAIHOC/DATN/leetcode-problems-master/merged_problems.json';

/**
 * Cleans the description by removing trailing boilerplate sections
 * (Example X:, Constraints:, Follow-up:) since these are stored separately.
 */
function cleanDescription(description: string): string {
  if (!description) return '';

  const cutPatterns = [
    /\n\s*Example\s+1\s*:/i,
    /\n\s*Examples?\s*:/i,
    /\n\s*Constraints?\s*:/i,
    /\n\s*Follow[\s-]?up\s*:/i,
  ];

  let cleaned = description;
  for (const pattern of cutPatterns) {
    const idx = cleaned.search(pattern);
    if (idx !== -1) {
      cleaned = cleaned.substring(0, idx).trim();
      break;
    }
  }

  return cleaned.trim();
}

/**
 * Parses the example_text to extract input and output for test cases.
 */
function parseExampleText(
  text: string,
): { input: string; output: string } | null {
  const inputMatch = text.match(/Input:\s*([\s\S]*?)(?=\nOutput:|$)/);
  const outputMatch = text.match(/Output:\s*([\s\S]*?)(?=\nExplanation:|$)/);

  if (inputMatch && outputMatch) {
    return {
      input: inputMatch[1].trim(),
      output: outputMatch[1].trim(),
    };
  }
  return null;
}

async function main() {
  console.log('Starting LeetCode Import (Rich Fields Mode)...');

  if (!fs.existsSync(LEETCODE_JSON_PATH)) {
    console.error(`Error: File not found at ${LEETCODE_JSON_PATH}`);
    return;
  }

  const rawData = fs.readFileSync(LEETCODE_JSON_PATH, 'utf-8');
  const jsonData = JSON.parse(rawData);
  const allProblems = jsonData.questions;

  if (!Array.isArray(allProblems)) {
    console.error('Error: "questions" is not an array.');
    return;
  }

  const sampleProblems = allProblems;

  // 1. Ensure "Algorithms" skill exists
  const algoSkill = await prisma.skill.upsert({
    where: { slug: 'algorithms' },
    update: {
      icon: 'https://cdn.simpleicons.org/leetcode/FFA116',
    },
    create: {
      name: 'Algorithms',
      slug: 'algorithms',
      description:
        'Master competitive programming and algorithmic thinking with top LeetCode challenges.',
      icon: 'https://cdn.simpleicons.org/leetcode/FFA116',
    },
  });

  console.log(`"Algorithms" skill verified (ID: ${algoSkill.id})`);

  let count = 0;
  let failed = 0;

  for (const prob of sampleProblems) {
    // --- Map difficulty ---
    let difficulty: Difficulty = Difficulty.EASY;
    if (prob.difficulty === 'Medium') difficulty = Difficulty.MEDIUM;
    if (prob.difficulty === 'Hard') difficulty = Difficulty.HARD;

    // --- Map topics to topics field (comma-separated) ---
    const topics =
      prob.topics && prob.topics.length > 0
        ? prob.topics.join(', ')
        : 'General';

    // --- Map examples (stored as structured JSON) ---
    const examples = prob.examples
      ? prob.examples.map((ex: any) => ({
          example_num: ex.example_num,
          example_text: ex.example_text?.trim() || '',
          images: ex.images || [],
        }))
      : [];

    // --- Extract test cases from examples ---
    const testCases: { input: string; output: string }[] = [];
    for (const ex of examples) {
      const parsed = parseExampleText(ex.example_text);
      if (parsed) testCases.push(parsed);
    }
    if (testCases.length === 0) {
      testCases.push({ input: 'N/A', output: 'N/A' });
    }

    // --- Map constraints (array of strings) ---
    const constraints = prob.constraints || [];

    // --- Map hints (array of strings) ---
    const hints = prob.hints || [];

    // --- Map follow_ups (array of strings) ---
    const followUps = prob.follow_ups || [];

    // --- Map solution (HTML string, may be null) ---
    const solution = prob.solutions || null;

    try {
      await prisma.challenge.upsert({
        where: { slug: prob.problem_slug },
        update: {
          // Update all fields if the slug already exists
          title: prob.title,
          description:
            cleanDescription(prob.description) || 'No description available.',
          difficulty,
          topics,
          examples,
          constraints,
          hints,
          solution,
          followUps,
          templateCode: prob.code_snippets || {},
          testCases,
        },
        create: {
          title: prob.title,
          slug: prob.problem_slug,
          description:
            cleanDescription(prob.description) || 'No description available.',
          difficulty,
          topics,
          examples,
          constraints,
          hints,
          solution,
          followUps,
          skillId: algoSkill.id,
          templateCode: prob.code_snippets || {},
          testCases,
        },
      });
      count++;
      if (count % 10 === 0) {
        console.log(`Imported ${count}/${sampleProblems.length} problems...`);
      }
    } catch (err: any) {
      failed++;
      console.error(`Failed to import: ${prob.title} — ${err.message}`);
    }
  }

  console.log(`\n Import complete! Success: ${count}, Failed: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
