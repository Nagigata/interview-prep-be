import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // Remove React skill and its challenges if it exists
  const reactSkill = await prisma.skill.findUnique({ where: { slug: 'react' }, include: { challenges: true } });
  if (reactSkill) {
    const challengeIds = reactSkill.challenges.map((c) => c.id);
    await prisma.challengeSubmission.deleteMany({ where: { challengeId: { in: challengeIds } } });
    await prisma.challengeStar.deleteMany({ where: { challengeId: { in: challengeIds } } });
    await prisma.challenge.deleteMany({ where: { skillId: reactSkill.id } });
    await prisma.skill.delete({ where: { id: reactSkill.id } });
  }

  // 1. Create Skills
  const python = await prisma.skill.upsert({
    where: { slug: 'python' },
    update: {
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
    },
    create: {
      name: 'Python',
      slug: 'python',
      description: 'Master Python programming from basics to advanced data structures.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
    },
  });

  const javascript = await prisma.skill.upsert({
    where: { slug: 'javascript' },
    update: {
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
    },
    create: {
      name: 'JavaScript',
      slug: 'javascript',
      description: 'The language of the web. Practice core JS concepts and closures.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
    },
  });

  await prisma.skill.upsert({
    where: { slug: 'typescript' },
    update: {
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
    },
    create: {
      name: 'TypeScript',
      slug: 'typescript',
      description: 'Strongly typed JavaScript. Learn interfaces, generics and more.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
    },
  });

  await prisma.skill.upsert({
    where: { slug: 'c' },
    update: {
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/c/c-original.svg',
    },
    create: {
      name: 'C',
      slug: 'c',
      description: 'Procedural programming and memory management.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/c/c-original.svg',
    },
  });

  await prisma.skill.upsert({
    where: { slug: 'cpp' },
    update: {
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg',
    },
    create: {
      name: 'C++',
      slug: 'cpp',
      description: 'Object-oriented programming with high performance.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg',
    },
  });

  await prisma.skill.upsert({
    where: { slug: 'java' },
    update: {
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
    },
    create: {
      name: 'Java',
      slug: 'java',
      description: 'Write once, run anywhere. Deep dive into OOP and JVM.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
    },
  });

  await prisma.skill.upsert({
    where: { slug: 'csharp' },
    update: {
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg',
    },
    create: {
      name: 'C#',
      slug: 'csharp',
      description: 'Modern, object-oriented, and type-safe programming language.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg',
    },
  });

  await prisma.skill.upsert({
    where: { slug: 'sql' },
    update: {
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/azuresqldatabase/azuresqldatabase-original.svg',
    },
    create: {
      name: 'SQL',
      slug: 'sql',
      description: 'Master relational database queries, joins, and indexing.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/azuresqldatabase/azuresqldatabase-original.svg',
    },
  });

  console.log('Skills created!');

  // 2. Create Challenges for Python (Example)
  await prisma.challenge.upsert({
    where: { slug: 'sum-of-two' },
    update: {},
    create: {
      title: 'Sum of Two Numbers',
      slug: 'sum-of-two',
      description:
        'Write a function that takes two numbers as input and returns their sum.',
      difficulty: 'EASY',
      topics: 'Fundamentals',
      skillId: python.id,
      templateCode: {
        python: 'def solve(a, b):\n    # Write your code here\n    pass',
      },
      testCases: [
        { input: '1, 2', output: '3' },
        { input: '10, 20', output: '30' },
      ],
    },
  });

  // Example challenges for JavaScript
  await prisma.challenge.upsert({
    where: { slug: 'hello-world-js' },
    update: {},
    create: {
      title: 'Hello World JS',
      slug: 'hello-world-js',
      description: 'Return the string "Hello World".',
      difficulty: 'EASY',
      topics: 'Fundamentals',
      skillId: javascript.id,
      templateCode: {
        javascript: 'function getGreeting() {\n  // Write your code here\n}',
      },
      testCases: [{ input: '', output: 'Hello World' }],
    },
  });

  console.log('Challenges created!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
