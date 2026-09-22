import { generateDeterministicTechnicalEvaluation } from "../services/realInterviewAI/deterministicEvaluator.js";

console.log("================================================================================");
console.log("TESTING GENERIC DETERMINISTIC TECHNICAL EVALUATION ENGINE (35 UNSEEN CASES)");
console.log("================================================================================\n");

const testQuestions = [
  // --- 1. KEYWORDS, PROTOCOLS & COMPLEXITY ---
  {
    id: "test_01",
    type: "KEYWORD",
    domain: "Python",
    question: "What keyword is used to define a class in Python?",
    expectedKnowledge: "The class keyword is used to declare and define classes in Python.",
    candidateAnswer: "class",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_02",
    type: "KEYWORD",
    domain: "Networking",
    question: "What HTTP method is generally used to retrieve data from a server without side effects?",
    expectedKnowledge: "The HTTP GET method is used for safe, idempotent retrieval of resources.",
    candidateAnswer: "GET",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_03",
    type: "KEYWORD",
    domain: "Networking",
    question: "Which transport layer protocol provides reliable, connection-oriented byte streams with error checking?",
    expectedKnowledge: "TCP (Transmission Control Protocol) provides connection-oriented, reliable transmission with flow control.",
    candidateAnswer: "TCP",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_04",
    type: "KEYWORD",
    domain: "Security",
    question: "What standard token format is commonly used for stateless authentication across web services?",
    expectedKnowledge: "JSON Web Tokens (JWT) are an open standard (RFC 7519) used for securely transmitting information as a JSON object.",
    candidateAnswer: "JWT",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_05",
    type: "KEYWORD",
    domain: "HTTP",
    question: "What HTTP status code represents 'Not Found'?",
    expectedKnowledge: "HTTP status code 404 indicates that the requested resource was not found on the server.",
    candidateAnswer: "404",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_06",
    type: "KEYWORD",
    domain: "Algorithms",
    question: "What is the average time complexity of searching an element in a balanced binary search tree?",
    expectedKnowledge: "Searching in a balanced BST takes O(log n) logarithmic time complexity.",
    candidateAnswer: "O(log n)",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },

  // --- 2. CLI & TERMINAL COMMANDS ---
  {
    id: "test_07",
    type: "CLI",
    domain: "Git",
    question: "What Git command is used to create a new branch named 'feature-login'?",
    expectedKnowledge: "Use git branch feature-login or git checkout -b feature-login to create a branch.",
    candidateAnswer: "git branch feature-login",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_08",
    type: "CLI",
    domain: "Git",
    question: "What Git command creates and immediately switches to a new branch called 'feature-auth'?",
    expectedKnowledge: "Use git checkout -b feature-auth or git switch -c feature-auth to create and switch branches.",
    candidateAnswer: "git checkout -b feature-auth",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_09",
    type: "CLI",
    domain: "Docker",
    question: "What command runs an Nginx container in detached mode mapping port 80 to host port 80?",
    expectedKnowledge: "Use docker run -d -p 80:80 nginx to run an Nginx container in background detached mode.",
    candidateAnswer: "docker run -d -p 80:80 nginx",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_10",
    type: "CLI",
    domain: "Linux",
    question: "What command changes the permissions of 'deploy.sh' to read, write, and execute for owner, and read/execute for others?",
    expectedKnowledge: "Use chmod 755 deploy.sh to grant read, write, and execute permissions to the owner.",
    candidateAnswer: "chmod 755 deploy.sh",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_11",
    type: "CLI",
    domain: "Git",
    question: "What Git command commits staged changes along with a descriptive commit message?",
    expectedKnowledge: "Use git commit -m \"commit message\" to record changes in repository history.",
    candidateAnswer: "git commit",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "PARTIALLY_CORRECT",
    expectedScore: 2, // Partial credit: identified git commit but omitted -m flag
  },
  {
    id: "test_12",
    type: "CLI",
    domain: "Git",
    question: "What Git command pushes committed changes from the local main branch to the origin remote?",
    expectedKnowledge: "Use git push origin main to push commits to the remote repository.",
    candidateAnswer: "git stash",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "INCORRECT",
    expectedScore: 0,
  },

  // --- 3. SQL QUERIES ---
  {
    id: "test_13",
    type: "SQL",
    domain: "Database",
    question: "Write a SQL query to retrieve all rows and columns from the 'Users' table.",
    expectedKnowledge: "SELECT * FROM Users; retrieves all columns and rows from the Users table.",
    candidateAnswer: "SELECT * FROM Users;",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_14",
    type: "SQL",
    domain: "Database",
    question: "Write a SQL query to retrieve all records from 'Customers'.",
    expectedKnowledge: "SELECT * FROM Customers; retrieves all customer records.",
    candidateAnswer: "select * from customers",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_15",
    type: "SQL",
    domain: "Database",
    question: "Write a SQL query to retrieve name and email of all employees in the 'Engineering' department from the 'Employees' table.",
    expectedKnowledge: "SELECT name, email FROM Employees WHERE department = 'Engineering';",
    candidateAnswer: "SELECT name, email FROM Employees WHERE department = 'Engineering';",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_16",
    type: "SQL",
    domain: "Database",
    question: "Write a SQL query to retrieve name and email of all employees in the 'Engineering' department from the 'Employees' table.",
    expectedKnowledge: "SELECT name, email FROM Employees WHERE department = 'Engineering';",
    candidateAnswer: "SELECT name, email FROM Employees;",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "PARTIALLY_CORRECT",
    expectedScore: 2, // Partial: missing WHERE filter clause
  },
  {
    id: "test_17",
    type: "SQL",
    domain: "Database",
    question: "Write a SQL query to retrieve all records from 'Users'.",
    expectedKnowledge: "SELECT * FROM Users;",
    candidateAnswer: "SELECT * FROM Invoices;",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "INCORRECT",
    expectedScore: 0,
  },

  // --- 4. CODE SNIPPETS & DATA STRUCTURES ---
  {
    id: "test_18",
    type: "CODE",
    domain: "Python",
    question: "How do you declare and initialize an empty list in Python?",
    expectedKnowledge: "Initialize an empty list using brackets my_list = [] or constructor my_list = list().",
    candidateAnswer: "my_list = []",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_19",
    type: "CODE",
    domain: "Python",
    question: "How do you declare and initialize an empty list in Python?",
    expectedKnowledge: "Initialize an empty list using my_list = [] or my_list = list().",
    candidateAnswer: "items = list()",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_20",
    type: "CODE",
    domain: "Python",
    question: "In Python, how do you access the value associated with key 'age' in a dictionary named 'student'?",
    expectedKnowledge: "Access key values using student['age'] or student.get('age').",
    candidateAnswer: "student['age']",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_21",
    type: "CODE",
    domain: "JavaScript",
    question: "In JavaScript, how do you append a new element 'newItem' to the end of an array named 'items'?",
    expectedKnowledge: "Use the push method items.push(newItem) to add elements to the end of an array.",
    candidateAnswer: "items.push(newItem);",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_22",
    type: "CODE",
    domain: "Python",
    question: "Write the function header in Python that defines a function named 'calculate_total' with parameters 'price' and 'tax'.",
    expectedKnowledge: "def calculate_total(price, tax): defines the function header.",
    candidateAnswer: "def calculate_total(price, tax):",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },

  // --- 5. OUTPUT PREDICTION ---
  {
    id: "test_23",
    type: "OUTPUT",
    domain: "Python",
    question: "What is the output of the following Python code: print(2 ** 3)?",
    expectedKnowledge: "8",
    candidateAnswer: "8",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_24",
    type: "OUTPUT",
    domain: "Python",
    question: "What is printed by print(5 > 10)?",
    expectedKnowledge: "False",
    candidateAnswer: "False",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "CORRECT",
    expectedScore: 3,
  },
  {
    id: "test_25",
    type: "OUTPUT",
    domain: "Python",
    question: "What is the output of print(len([10, 20, 30]))?",
    expectedKnowledge: "3",
    candidateAnswer: "10",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "INCORRECT",
    expectedScore: 0,
  },

  // --- 6. CONCEPTUAL QUESTIONS (MEDIUM - 5 MARKS) ---
  {
    id: "test_26",
    type: "CONCEPT",
    domain: "OOP",
    question: "What is polymorphism in Object-Oriented Programming?",
    expectedKnowledge: "Polymorphism is an OOP principle that allows objects of different classes to be treated as objects of a common superclass, enabling different implementations of the same interface or method.",
    candidateAnswer: "Polymorphism allows the same interface to take on different forms or implementations depending on the underlying object type.",
    difficulty: "medium",
    maxScore: 5,
    expectedStatus: "CORRECT",
    expectedScore: 5,
  },
  {
    id: "test_27",
    type: "CONCEPT",
    domain: "OOP",
    question: "What is polymorphism in Object-Oriented Programming?",
    expectedKnowledge: "Polymorphism allows objects to share a common interface while providing distinct implementations at runtime.",
    candidateAnswer: "Polymorphism means having different behaviors in OOP.",
    difficulty: "medium",
    maxScore: 5,
    expectedStatus: "PARTIALLY_CORRECT",
    minScore: 2,
    maxAllowedScore: 4,
  },
  {
    id: "test_28",
    type: "CONCEPT_CONTRADICTION",
    domain: "OOP",
    question: "What is polymorphism in Object-Oriented Programming?",
    expectedKnowledge: "Polymorphism is an OOP concept enabling different class implementations for a single interface.",
    candidateAnswer: "Polymorphism is a relational database management system used to store tables.",
    difficulty: "medium",
    maxScore: 5,
    expectedStatus: "INCORRECT",
    expectedScore: 0, // False contradictory claim must get 0
  },
  {
    id: "test_29",
    type: "CONCEPT",
    domain: "Node.js",
    question: "Explain the role of the Event Loop in Node.js and how it enables non-blocking I/O operations.",
    expectedKnowledge: "Node.js event loop uses libuv to handle async non-blocking I/O across timers, poll, and check phases on a single execution thread, offloading expensive I/O tasks to the worker thread pool.",
    candidateAnswer: "The event loop in Node.js uses libuv to execute asynchronous callbacks without blocking the single execution thread by managing timer and I/O polling queues.",
    difficulty: "medium",
    maxScore: 5,
    expectedStatus: "CORRECT",
    expectedScore: 5,
  },
  {
    id: "test_30",
    type: "CONCEPT",
    domain: "Databases / Caching",
    question: "What is Redis and what are its primary use cases?",
    expectedKnowledge: "Redis is an in-memory key-value data structure store used primarily as a fast distributed cache, session store, and message broker.",
    candidateAnswer: "Redis is an in-memory key-value data store commonly used for caching, session management, and high-throughput low-latency data access.",
    difficulty: "medium",
    maxScore: 5,
    expectedStatus: "CORRECT",
    expectedScore: 5,
  },
  {
    id: "test_31",
    type: "CONCEPT_CONTRADICTION",
    domain: "Networking / HTTP",
    question: "What does the HTTP GET method do?",
    expectedKnowledge: "The HTTP GET method retrieves representation of the target resource safely without mutating server state.",
    candidateAnswer: "HTTP GET deletes a resource from the server.",
    difficulty: "medium",
    maxScore: 5,
    expectedStatus: "INCORRECT",
    expectedScore: 0, // Contradiction: claiming GET deletes resource
  },

  // --- 7. ARCHITECTURE / SYSTEM DESIGN (HARD - 13 MARKS) ---
  {
    id: "test_32",
    type: "ARCHITECTURE",
    domain: "Cloud / AWS",
    question: "Design a highly available and scalable web application architecture on AWS.",
    expectedKnowledge: "A highly available AWS architecture deploys stateless application servers in an Auto Scaling group across multiple Availability Zones behind an Application Load Balancer (ALB), with Amazon RDS Multi-AZ for relational database failover, Amazon ElastiCache for caching, S3 and CloudFront for static assets, and CloudWatch for monitoring.",
    candidateAnswer: "Deploy stateless web instances in an Auto Scaling group distributed across multiple Availability Zones behind an Application Load Balancer. Use Amazon RDS in Multi-AZ configuration for automated database failover, ElastiCache Redis for fast caching, S3 with CloudFront CDN for static content, and CloudWatch for metrics.",
    difficulty: "hard",
    maxScore: 13,
    expectedStatus: "CORRECT",
    expectedScore: 13,
  },
  {
    id: "test_33",
    type: "ARCHITECTURE",
    domain: "Cloud / AWS",
    question: "Design a highly available and scalable web application architecture on AWS.",
    expectedKnowledge: "Deploy stateless compute across multiple AZs with ALB, Multi-AZ database, caching, and CDN.",
    candidateAnswer: "We can deploy an Application Load Balancer in AWS with a couple of EC2 instances.",
    difficulty: "hard",
    maxScore: 13,
    expectedStatus: "PARTIALLY_CORRECT",
    minScore: 4,
    maxAllowedScore: 8, // Genuine partial credit for basic load balancing mention
  },
  {
    id: "test_34",
    type: "ARCHITECTURE",
    domain: "Cloud / AWS",
    question: "Design a highly available and scalable web application architecture on AWS.",
    expectedKnowledge: "Deploy stateless compute across multiple AZs with ALB, Multi-AZ database, caching, and CDN.",
    candidateAnswer: "To make it scalable, install Photoshop and restart the computer daily.",
    difficulty: "hard",
    maxScore: 13,
    expectedStatus: "INCORRECT",
    expectedScore: 0, // Nonsensical / irrelevant answer
  },

  // --- 8. UNANSWERED / EMPTY ---
  {
    id: "test_35",
    type: "EMPTY",
    domain: "General",
    question: "Explain the difference between SQL and NoSQL databases.",
    expectedKnowledge: "SQL databases are relational and table-based with fixed schemas, while NoSQL databases are non-relational document/key-value stores with dynamic schemas.",
    candidateAnswer: "(No answer submitted)",
    difficulty: "easy",
    maxScore: 3,
    expectedStatus: "NOT_ATTEMPTED",
    expectedScore: 0,
  },
];

const batchInput = testQuestions.map((q) => ({
  questionId: q.id,
  question: q.question,
  expectedKnowledge: q.expectedKnowledge,
  candidateAnswer: q.candidateAnswer,
  difficulty: q.difficulty,
  maxScore: q.maxScore,
}));

const result = generateDeterministicTechnicalEvaluation(batchInput, "Unseen generic test harness");

let passedCount = 0;
let failedCount = 0;

console.log("================================================================================");
console.log("EXECUTION RESULTS TABLE (35 UNSEEN CASES):");
console.log("================================================================================\n");

for (let i = 0; i < testQuestions.length; i++) {
  const tc = testQuestions[i];
  const evalItem = result.evaluations.find((e) => e.questionId === tc.id);
  const score = evalItem ? evalItem.score : -1;
  const status = evalItem ? evalItem.status : "ERROR";

  let pass = true;
  let failReason = "";

  if (tc.expectedScore !== undefined && score !== tc.expectedScore) {
    pass = false;
    failReason = `Score mismatch: expected ${tc.expectedScore}, got ${score}`;
  } else if (tc.minScore !== undefined && score < tc.minScore) {
    pass = false;
    failReason = `Score too low: expected >= ${tc.minScore}, got ${score}`;
  } else if (tc.maxAllowedScore !== undefined && score > tc.maxAllowedScore) {
    pass = false;
    failReason = `Score too high: expected <= ${tc.maxAllowedScore}, got ${score}`;
  }

  if (status !== tc.expectedStatus) {
    pass = false;
    failReason += ` | Status mismatch: expected ${tc.expectedStatus}, got ${status}`;
  }

  if (pass) {
    passedCount++;
    console.log(`[PASS] ${tc.id.padEnd(8)} [${tc.type.padEnd(10)}] (${tc.domain.padEnd(12)}) Score: ${score}/${tc.maxScore} | Status: ${status.padEnd(17)} | Feedback: ${evalItem.feedback.slice(0, 50)}...`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${tc.id.padEnd(8)} [${tc.type.padEnd(10)}] (${tc.domain.padEnd(12)}) Score: ${score}/${tc.maxScore} | Status: ${status.padEnd(17)} | REASON: ${failReason}`);
  }
}

console.log("\n================================================================================");
console.log(`FINAL RESULT: ${passedCount}/${testQuestions.length} TESTS PASSED (${failedCount} failed)`);
console.log("================================================================================");
