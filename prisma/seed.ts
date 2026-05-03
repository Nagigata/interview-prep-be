import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 0. Seed admin account
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@prepwise.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const adminPassword = await bcrypt.hash(adminPass, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      name: 'Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin account seeded (${adminEmail})`);
  await prisma.challenge.deleteMany({
    where: {
      slug: {
        in: [
          'python-list-filter', 'python-dict-freq',
          'js-array-transform', 'js-promise-resolver',
          'ts-type-guards', 'ts-generic-box',
          'c-pointer-swap', 'c-string-reverse',
          'cpp-vector-sort', 'cpp-class-encap',
          'java-method-overload', 'java-string-builder',
          'cs-linq-filter', 'cs-delegate-event',
          'sql-basic-join', 'sql-group-having'
        ]
      }
    }
  });

  // 1. Create Skills (đã bao gồm các ngôn ngữ mới và icon)
  const skillsData = [
    { name: 'Python', slug: 'python', desc: 'Master Python programming.', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg' },
    { name: 'JavaScript', slug: 'javascript', desc: 'The language of the web.', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg' },
    { name: 'TypeScript', slug: 'typescript', desc: 'Strongly typed JavaScript.', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg' },
    { name: 'C', slug: 'c', desc: 'Procedural programming.', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/c/c-original.svg' },
    { name: 'C++', slug: 'cpp', desc: 'Object-oriented programming.', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg' },
    { name: 'Java', slug: 'java', desc: 'Deep dive into OOP and JVM.', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg' },
    { name: 'C#', slug: 'csharp', desc: 'Modern type-safe programming language.', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg' },
    { name: 'SQL', slug: 'sql', desc: 'Master relational databases.', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/azuresqldatabase/azuresqldatabase-original.svg' },
    { name: 'Algorithms', slug: 'algorithms', desc: 'Data structures and algorithm problems.', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/thealgorithms/thealgorithms-original.svg' },
  ];

  const skillDocs: Record<string, any> = {};

  for (const s of skillsData) {
    skillDocs[s.slug] = await prisma.skill.upsert({
      where: { slug: s.slug },
      update: { icon: s.icon },
      create: { name: s.name, slug: s.slug, description: s.desc, icon: s.icon }
    });
  }

  console.log('Skills verified!');

  const challengesToCreate = [
    // === PYTHON ===
    {
      title: 'List Comprehensions Filter', slug: 'python-list-filter', skillId: skillDocs['python'].id,
      difficulty: 'EASY', topics: 'Syntax,List',
      description: 'Given a list of integers, use a list comprehension to filter out only the even numbers and double them.',
      examples: [
        { input: '[1, 2, 3, 4]', output: '[4, 8]', explanation: '2 is even (doubled to 4). 4 is even (doubled to 8).' }
      ],
      constraints: ['0 <= len(arr) <= 10^4', 'arr[i] can be negative'],
      hints: ['Remember the syntax: [expression for item in list if condition]'],
      templateCode: { python: 'def solve(arr):\n    # Write your list comprehension here\n    pass' },
      testCases: [{ input: '1, 2, 3, 4', output: '[4, 8]' }]
    },
    {
      title: 'Dictionary Frequency Counter', slug: 'python-dict-freq', skillId: skillDocs['python'].id,
      difficulty: 'MEDIUM', topics: 'Dictionary,Hash',
      description: 'Write a function that counts the frequency of each character in a given string and returns a dictionary.',
      examples: [
        { input: '"hello"', output: "{'h': 1, 'e': 1, 'l': 2, 'o': 1}", explanation: 'Count of each character in hello.' }
      ],
      constraints: ['1 <= string length <= 10^5'],
      hints: ['You can use a normal loop or collections.Counter'],
      templateCode: { python: 'def solve(s):\n    # Return a frequency dictionary\n    pass' },
      testCases: [{ input: '"hello"', output: "{'h': 1, 'e': 1, 'l': 2, 'o': 1}" }]
    },

    // === JAVASCRIPT ===
    {
      title: 'Array Transformations', slug: 'js-array-transform', skillId: skillDocs['javascript'].id,
      difficulty: 'EASY', topics: 'Array,Functional',
      description: 'Given an array of numbers, chain array methods to filter out numbers less than 10, then multiply the remaining numbers by 10.',
      examples: [
        { input: '[5, 12, 8, 130, 44]', output: '[120, 1300, 440]', explanation: 'Filter keeps 12, 130, 44. Map multiplies them by 10.' }
      ],
      constraints: ['Array contains standard integers.'],
      hints: ['Chain .filter() and .map()'],
      templateCode: { javascript: 'function solve(arr) {\n  // Write your code here\n}' },
      testCases: [{ input: '[5, 12, 8, 130, 44]', output: '[120, 1300, 440]' }]
    },
    {
      title: 'Promise Resolver', slug: 'js-promise-resolver', skillId: skillDocs['javascript'].id,
      difficulty: 'MEDIUM', topics: 'Async,Promises',
      description: 'Write an async function that returns "Success" after exactly 1 second using a Promise.',
      examples: [
        { input: '()', output: '"Success"', explanation: 'Function resolves to Success after 1000ms.' }
      ],
      constraints: ['Must use setTimeout'],
      hints: ['Return a new Promise((resolve, reject) => {...})'],
      templateCode: { javascript: 'async function solve() {\n  // Return a promise\n}' },
      testCases: [{ input: '', output: '"Success"' }]
    },

    // === TYPESCRIPT ===
    {
      title: 'Type Guards', slug: 'ts-type-guards', skillId: skillDocs['typescript'].id,
      difficulty: 'EASY', topics: 'Types',
      description: 'Write a function that accepts `unknown` and returns the string length if it is a string, or 0 otherwise.',
      examples: [
        { input: '"hello"', output: '5', explanation: 'It is a string of length 5.' },
        { input: '42', output: '0', explanation: 'Not a string.' }
      ],
      constraints: ['Input can be any JS primitive.'],
      hints: ['Use the typeof operator.'],
      templateCode: { typescript: 'function solve(val: unknown): number {\n  // Write your code here\n}' },
      testCases: [{ input: '"hello"', output: '5' }]
    },
    {
      title: 'Generic Box', slug: 'ts-generic-box', skillId: skillDocs['typescript'].id,
      difficulty: 'MEDIUM', topics: 'Generics,Classes',
      description: 'Export a Generic class `Box<T>` that has a constructor accepting an initial value, a `getValue` method, and a `setValue` method.',
      examples: [
        { input: 'Box<number>(10)', output: '10', explanation: 'Creates a box holding number 10.' }
      ],
      constraints: ['Use generic syntax <T>.'],
      hints: ['class Box<T> { ... }'],
      templateCode: { typescript: 'class Box<T> {\n  // Implement class\n}' },
      testCases: [{ input: '', output: '' }]
    },

    // === C ===
    {
      title: 'Pointer Swap', slug: 'c-pointer-swap', skillId: skillDocs['c'].id,
      difficulty: 'EASY', topics: 'Pointers',
      description: 'Write a C function `void swap(int *a, int *b)` that swaps the values of two variables using pointers.',
      examples: [
        { input: 'a=5, b=10', output: 'a=10, b=5', explanation: 'Values swapped.' }
      ],
      constraints: ['Must modify in-place.'],
      hints: ['Store *a in a temp variable.'],
      templateCode: { c: 'void swap(int *a, int *b) {\n  // Swap logic\n}' },
      testCases: [{ input: '5, 10', output: '10, 5' }]
    },
    {
      title: 'In-place String Reversal', slug: 'c-string-reverse', skillId: skillDocs['c'].id,
      difficulty: 'MEDIUM', topics: 'Strings,Pointers',
      description: 'Reverse a C string (char array) in-place.',
      examples: [
        { input: '"hello"', output: '"olleh"', explanation: 'String is reversed.' }
      ],
      constraints: ['Do not allocate a new string.'],
      hints: ['Use two pointers (start and end).'],
      templateCode: { c: 'void reverseString(char* s) {\n  // Write logic\n}' },
      testCases: [{ input: '"hello"', output: '"olleh"' }]
    },

    // === C++ ===
    {
      title: 'Vector Sorting', slug: 'cpp-vector-sort', skillId: skillDocs['cpp'].id,
      difficulty: 'EASY', topics: 'STL,Sorting',
      description: 'Write a function that takes a `std::vector<int>` and sorts it in descending order.',
      examples: [
        { input: '[1, 5, 2]', output: '[5, 2, 1]', explanation: 'Sorted backwards.' }
      ],
      constraints: ['Use std::sort'],
      hints: ['Pass std::greater<int>() to std::sort'],
      templateCode: { cpp: '#include <vector>\n#include <algorithm>\n\nvoid solve(std::vector<int>& arr) {\n  // Sort descending\n}' },
      testCases: [{ input: '[1, 5, 2]', output: '[5, 2, 1]' }]
    },
    {
      title: 'Class Encapsulation', slug: 'cpp-class-encap', skillId: skillDocs['cpp'].id,
      difficulty: 'MEDIUM', topics: 'OOP',
      description: 'Create a class `BankAccount` with a private `balance` and public `deposit(amount)` and `getBalance()` methods.',
      examples: [
        { input: 'deposit(50)', output: '50', explanation: 'Balance becomes 50.' }
      ],
      constraints: ['Balance must be non-negative.'],
      hints: ['Use public: and private: access modifiers.'],
      templateCode: { cpp: 'class BankAccount {\n  // Implementation\n};' },
      testCases: [{ input: '', output: '' }]
    },

    // === JAVA ===
    {
      title: 'Method Overloading', slug: 'java-method-overload', skillId: skillDocs['java'].id,
      difficulty: 'EASY', topics: 'OOP,Methods',
      description: 'Create a class `Calculator` with two `add` methods: one adding two integers, and one adding three integers.',
      examples: [
        { input: 'add(1, 2) | add(1, 2, 3)', output: '3 | 6', explanation: 'Calls respective overloaded implementations.' }
      ],
      constraints: ['Must use the same method name.'],
      hints: ['Change the method signature (parameter list).'],
      templateCode: { java: 'class Calculator {\n  // Overloaded methods here\n}' },
      testCases: [{ input: '', output: '' }]
    },
    {
      title: 'StringBuilder Usage', slug: 'java-string-builder', skillId: skillDocs['java'].id,
      difficulty: 'MEDIUM', topics: 'Strings,Efficiency',
      description: 'Concatenate an array of strings efficiently using `StringBuilder` and return the result.',
      examples: [
        { input: '["a", "b", "c"]', output: '"abc"', explanation: 'Strings are combined.' }
      ],
      constraints: ['Avoid using the + operator for strings in loops.'],
      hints: ['Initialize new StringBuilder(), then use .append()'],
      templateCode: { java: 'public String solve(String[] words) {\n  // Implementation\n}' },
      testCases: [{ input: '["a", "b"]', output: '"ab"' }]
    },

    // === C# ===
    {
      title: 'LINQ Filtering', slug: 'cs-linq-filter', skillId: skillDocs['csharp'].id,
      difficulty: 'EASY', topics: 'LINQ',
      description: 'Given a `List<int>`, use LINQ to return a list of numbers strictly greater than 50.',
      examples: [
        { input: '[10, 60, 50, 90]', output: '[60, 90]', explanation: 'Only 60 and 90 are > 50.' }
      ],
      constraints: ['Must use System.Linq'],
      hints: ['Use list.Where(x => ...).ToList()'],
      templateCode: { csharp: 'using System;\nusing System.Linq;\nusing System.Collections.Generic;\n\npublic class Program {\n  public List<int> solve(List<int> numbers) {\n    // LINQ logic\n  }\n}' },
      testCases: [{ input: '[10, 60, 50, 90]', output: '[60, 90]' }]
    },
    {
      title: 'Delegates Basics', slug: 'cs-delegate-event', skillId: skillDocs['csharp'].id,
      difficulty: 'MEDIUM', topics: 'Delegates',
      description: 'Declare a delegate `MathOp` that takes two integers and returns an integer. Write a function that accepts this delegate to execute an operation.',
      examples: [
        { input: 'execute(MathOp(Add), 5, 5)', output: '10', explanation: 'Delegate calls the Add function.' }
      ],
      constraints: ['Standard C# 8+ syntax.'],
      hints: ['delegate int MathOp(int a, int b);'],
      templateCode: { csharp: 'public delegate int MathOp(int a, int b);\n\npublic class Program {\n  public int execute(MathOp op, int a, int b) {\n    return op(a, b);\n  }\n}' },
      testCases: [{ input: '', output: '' }]
    },

    // === SQL ===
    {
      title: 'Basic JOIN Query', slug: 'sql-basic-join', skillId: skillDocs['sql'].id,
      difficulty: 'EASY', topics: 'SELECT,JOIN',
      description: 'Write a SQL query to fetch the `employee_name` and their `department_name` by joining `employees` and `departments` tables on `department_id`.',
      examples: [
        { input: 'Tables: employees, departments', output: 'A list of names and departments.', explanation: 'Standard INNER JOIN output.' }
      ],
      constraints: ['Use INNER JOIN.'],
      hints: ['SELECT e.name, d.name FROM employees e INNER JOIN departments d ON ...'],
      templateCode: { sql: '-- Write your query here\nSELECT ' },
      testCases: [{ input: 'JOIN test', output: 'SUCCESS' }]
    },
    {
      title: 'GROUP BY and HAVING', slug: 'sql-group-having', skillId: skillDocs['sql'].id,
      difficulty: 'MEDIUM', topics: 'Aggregations',
      description: 'Write a SQL query to count total orders per `customer_id` from the `orders` table, but only return customers who have more than 5 orders.',
      examples: [
        { input: 'Table: orders', output: 'customer_id | total_orders', explanation: 'Filtered with HAVING COUNT(*) > 5' }
      ],
      constraints: ['Must alias count column as total_orders.'],
      hints: ['GROUP BY customer_id HAVING count(*) > 5'],
      templateCode: { sql: '-- Write your query here\nSELECT customer_id, COUNT(*) as total_orders' },
      testCases: [{ input: 'HAVING test', output: 'SUCCESS' }]
    }
  ];

  for (const c of challengesToCreate) {
    await prisma.challenge.upsert({
      where: { slug: c.slug },
      update: {
        title: c.title,
        description: c.description,
        difficulty: c.difficulty as any,
        topics: c.topics,
        examples: c.examples,
        constraints: c.constraints,
        hints: c.hints,
        templateCode: c.templateCode,
        testCases: c.testCases
      },
      create: {
        title: c.title,
        slug: c.slug,
        skillId: c.skillId,
        description: c.description,
        difficulty: c.difficulty as any,
        topics: c.topics,
        examples: c.examples,
        constraints: c.constraints,
        hints: c.hints,
        templateCode: c.templateCode,
        testCases: c.testCases
      }
    });
  }

  console.log(`✅ successfully seeded ${challengesToCreate.length} language-specific challenges!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
