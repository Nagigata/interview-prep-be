import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 1. Create Skills
  const python = await prisma.skill.upsert({
    where: { slug: 'python' },
    update: {},
    create: {
      name: 'Python',
      slug: 'python',
      description: 'Master Python programming from basics to advanced data structures.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
    },
  });

  const react = await prisma.skill.upsert({
    where: { slug: 'react' },
    update: {},
    create: {
      name: 'React',
      slug: 'react',
      description: 'Build modern user interfaces with React and functional components.',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
    },
  });

  console.log('Skills created!');

  // 2. Create Challenges for Python
  await prisma.challenge.upsert({
    where: { slug: 'sum-of-two' },
    update: {},
    create: {
      title: 'Sum of Two Numbers',
      slug: 'sum-of-two',
      description: 'Write a function that takes two numbers as input and returns their sum.',
      difficulty: 'EASY',
      subdomain: 'Fundamentals',
      skillLevel: 'Basic',
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

  // 3. Create Challenges for React
  await prisma.challenge.upsert({
    where: { slug: 'hello-world-react' },
    update: {},
    create: {
      title: 'Hello World React',
      slug: 'hello-world-react',
      description: 'Create a simple React component that returns a div saying "Hello World".',
      difficulty: 'EASY',
      subdomain: 'Components',
      skillLevel: 'Basic',
      skillId: react.id,
      templateCode: {
        javascript: 'import React from "react";\n\nconst Welcome = () => {\n  // Write your code here\n};',
      },
      testCases: [
        { input: '', output: 'Hello World' },
      ],
    },
  });

  await prisma.challenge.upsert({
    where: { slug: 'counter-react' },
    update: {},
    create: {
      title: 'Counter Hook',
      slug: 'counter-react',
      description: 'Implement a counter using useState hook.',
      difficulty: 'MEDIUM',
      subdomain: 'State Management',
      skillLevel: 'Intermediate',
      skillId: react.id,
      templateCode: {
        javascript: 'import React, { useState } from "react";\n\nconst Counter = () => {\n  // Write your code here\n};',
      },
      testCases: [
        { input: 'increment', output: '1' },
      ],
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
