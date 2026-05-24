import { PrismaClient, Difficulty } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const JSON_PATH = path.join(__dirname, 'data', 'language-challenges.json');

type Challenge = {
  title: string;
  slug: string;
  skillSlug: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topics: string;
  description: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  constraints: string[];
  hints: string[];
  templateCode: Record<string, string>;
  testCases: Array<{ input: string; output: string }>;
  referenceSolution?: Record<string, string>;
};

async function main() {
  console.log('Importing language challenges...');

  if (!fs.existsSync(JSON_PATH)) {
    console.error(`Error: File not found at ${JSON_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(JSON_PATH, 'utf-8');
  const challenges: Challenge[] = JSON.parse(raw);

  if (!Array.isArray(challenges)) {
    console.error('Error: JSON root must be an array.');
    process.exit(1);
  }

  const uniqueSlugs = Array.from(new Set(challenges.map((c) => c.skillSlug)));
  const skills = await prisma.skill.findMany({
    where: { slug: { in: uniqueSlugs } },
    select: { id: true, slug: true },
  });
  const skillIdBySlug = new Map(skills.map((s) => [s.slug, s.id]));

  const missing = uniqueSlugs.filter((s) => !skillIdBySlug.has(s));
  if (missing.length > 0) {
    console.error(
      `Missing skills in DB: ${missing.join(', ')}. Run seed.ts first.`,
    );
    process.exit(1);
  }

  let count = 0;
  let failed = 0;

  for (const c of challenges) {
    const skillId = skillIdBySlug.get(c.skillSlug)!;
    const { referenceSolution: _ref, skillSlug: _ss, ...data } = c;
    void _ref;
    void _ss;

    try {
      await prisma.challenge.upsert({
        where: { slug: c.slug },
        update: {
          title: data.title,
          description: data.description,
          difficulty: data.difficulty as Difficulty,
          topics: data.topics,
          examples: data.examples,
          constraints: data.constraints,
          hints: data.hints,
          templateCode: data.templateCode,
          testCases: data.testCases,
        },
        create: {
          title: data.title,
          slug: data.slug,
          skillId,
          description: data.description,
          difficulty: data.difficulty as Difficulty,
          topics: data.topics,
          examples: data.examples,
          constraints: data.constraints,
          hints: data.hints,
          templateCode: data.templateCode,
          testCases: data.testCases,
        },
      });
      count++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed: ${c.slug} - ${msg}`);
    }
  }

  console.log(`\nDone. Imported: ${count}, Failed: ${failed}`);

  const bySkill = new Map<string, number>();
  for (const c of challenges) {
    bySkill.set(c.skillSlug, (bySkill.get(c.skillSlug) || 0) + 1);
  }
  console.log('\nBy skill:');
  for (const [slug, n] of bySkill.entries()) {
    console.log(`  ${slug}: ${n}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
