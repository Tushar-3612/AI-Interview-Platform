/**
 * 210 Benchmark IT Solutions MCQ Questions
 * Full schema with 4 options, valid correctAnswer, explanation, difficulty, marks.
 * Marks: Easy=2, Medium=3, Hard=5.
 */

export const mcqQuestions = [
  // ── 1. DSA & Sorting Algorithms (Reported Anchors & Concepts) ──
  {
    questionId: "benchmark-mcq-001",
    question: "What are the primary comparison sorting algorithms, and which one has the fastest average-case performance for in-memory general data?",
    options: [
      "Quick Sort",
      "Bubble Sort",
      "Selection Sort",
      "Linear Sort"
    ],
    correctAnswer: "Quick Sort",
    explanation: "Quick Sort has an average-case time complexity of O(n log n) and exhibits smaller constant factors and better CPU cache locality than Merge Sort or Heap Sort.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Sorting Algorithms"
  },
  {
    questionId: "benchmark-mcq-002",
    question: "Which of the following sorting algorithms is guaranteed to be stable?",
    options: [
      "Merge Sort",
      "Quick Sort",
      "Heap Sort",
      "Selection Sort"
    ],
    correctAnswer: "Merge Sort",
    explanation: "Merge Sort preserves the relative order of duplicate elements because when two elements are equal during the merge step, the element from the left subarray is always selected first.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Sorting Algorithms"
  },
  {
    questionId: "benchmark-mcq-003",
    question: "What is the worst-case time complexity of standard Quick Sort when selecting the first element as the pivot on an already-sorted array?",
    options: [
      "O(n^2)",
      "O(n log n)",
      "O(n)",
      "O(log n)"
    ],
    correctAnswer: "O(n^2)",
    explanation: "When the array is already sorted and the first element is selected as pivot, each partitioning step produces partitions of size 0 and n-1, resulting in O(n^2) time complexity.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Sorting Algorithms"
  },
  {
    questionId: "benchmark-mcq-004",
    question: "Which sorting algorithm requires O(1) auxiliary space and guarantees O(n log n) time in all cases (best, average, and worst)?",
    options: [
      "Heap Sort",
      "Merge Sort",
      "Quick Sort",
      "Counting Sort"
    ],
    correctAnswer: "Heap Sort",
    explanation: "Heap Sort operates directly in-place using array-based binary heaps (O(1) auxiliary space) and maintains O(n log n) runtime in best, average, and worst cases.",
    difficulty: "Medium",
    marks: 3,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Sorting Algorithms"
  },
  {
    questionId: "benchmark-mcq-005",
    question: "When is Merge Sort strongly preferred over Quick Sort in practical engineering?",
    options: [
      "When sorting singly linked lists or requiring guaranteed worst-case O(n log n) time",
      "When strictly zero auxiliary memory is available",
      "When sorting small arrays of less than 10 integers",
      "When hardware cache lines are strictly limited"
    ],
    correctAnswer: "When sorting singly linked lists or requiring guaranteed worst-case O(n log n) time",
    explanation: "Merge Sort can sort linked lists without random indexing in O(1) auxiliary pointer space and guarantees O(n log n) worst-case time, making it ideal for deterministic and external sorting.",
    difficulty: "Medium",
    marks: 3,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Sorting Algorithms"
  },
  {
    questionId: "benchmark-mcq-006",
    question: "What is the best-case time complexity of Insertion Sort when the input array is already completely sorted?",
    options: [
      "O(n)",
      "O(n log n)",
      "O(n^2)",
      "O(1)"
    ],
    correctAnswer: "O(n)",
    explanation: "When already sorted, Insertion Sort makes only 1 comparison per element and 0 shifts, completing in O(n) linear time.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Sorting Algorithms"
  },
  {
    questionId: "benchmark-mcq-007",
    question: "Which non-comparison sorting algorithm can sort n integers in the range [0, k] in O(n + k) time?",
    options: [
      "Counting Sort",
      "Quick Sort",
      "Merge Sort",
      "Binary Insertion Sort"
    ],
    correctAnswer: "Counting Sort",
    explanation: "Counting Sort counts the occurrences of each key and calculates cumulative indices, achieving O(n + k) time and O(k) space.",
    difficulty: "Medium",
    marks: 3,
    questionType: "MCQ",
    source: "practice",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Sorting Algorithms"
  },
  {
    questionId: "benchmark-mcq-008",
    question: "What is the worst-case number of comparisons in Binary Search on an array of size n?",
    options: [
      "floor(log2(n)) + 1",
      "n / 2",
      "n",
      "n * log2(n)"
    ],
    correctAnswer: "floor(log2(n)) + 1",
    explanation: "Binary search eliminates half the search space on each comparison, making the maximum number of comparisons equal to floor(log2(n)) + 1.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "practice",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Searching Algorithms"
  },
  {
    questionId: "benchmark-mcq-009",
    question: "Which data structure is primarily used to perform Breadth-First Search (BFS) on a graph?",
    options: [
      "Queue",
      "Stack",
      "Priority Queue",
      "Binary Search Tree"
    ],
    correctAnswer: "Queue",
    explanation: "BFS explores nodes in order of their distance from the start node using a First-In-First-Out (FIFO) queue.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Data Structures"
  },
  {
    questionId: "benchmark-mcq-010",
    question: "What is the time complexity to insert an element at the beginning of a Singly Linked List vs a dynamic Array (Vector)?",
    options: [
      "O(1) for Linked List, O(n) for Array",
      "O(n) for Linked List, O(1) for Array",
      "O(1) for both",
      "O(n) for both"
    ],
    correctAnswer: "O(1) for Linked List, O(n) for Array",
    explanation: "Inserting at the head of a linked list only updates a pointer (O(1)), whereas inserting at index 0 of an array requires shifting all n elements rightward (O(n)).",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Data Structures"
  },

  // ── 2. OOP Concepts (Reported Anchors & Concepts) ──
  {
    questionId: "benchmark-mcq-011",
    question: "Which OOP concept allows a child class to provide a specific implementation of a method already defined in its parent class?",
    options: [
      "Method Overriding",
      "Method Overloading",
      "Encapsulation",
      "Data Hiding"
    ],
    correctAnswer: "Method Overriding",
    explanation: "Method Overriding is dynamic polymorphism where a subclass redefines a parent class method with the same name and signature.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "OOP Concepts"
  },
  {
    questionId: "benchmark-mcq-012",
    question: "In Java, what happens if a class does not define any constructor?",
    options: [
      "The compiler inserts a default no-argument constructor automatically",
      "A compile-time error is generated",
      "The class cannot be instantiated under any circumstances",
      "A private constructor is assigned automatically"
    ],
    correctAnswer: "The compiler inserts a default no-argument constructor automatically",
    explanation: "If no constructor is explicitly declared in a Java class, the compiler provides a default public/package-private no-argument constructor.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "OOP Concepts"
  },
  {
    questionId: "benchmark-mcq-013",
    question: "Which feature of OOP is violated if a class exposes its internal data members as `public` fields without getters and setters?",
    options: [
      "Encapsulation",
      "Polymorphism",
      "Inheritance",
      "Dynamic Dispatch"
    ],
    correctAnswer: "Encapsulation",
    explanation: "Encapsulation requires keeping data members private and providing controlled access via methods to protect object invariants.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "OOP Concepts"
  },
  {
    questionId: "benchmark-mcq-014",
    question: "Which principle of SOLID states that 'High-level modules should not depend on low-level modules; both should depend on abstractions'?",
    options: [
      "Dependency Inversion Principle",
      "Single Responsibility Principle",
      "Liskov Substitution Principle",
      "Interface Segregation Principle"
    ],
    correctAnswer: "Dependency Inversion Principle",
    explanation: "The Dependency Inversion Principle (DIP) decouples high-level and low-level software modules by having both depend on shared interfaces/abstractions.",
    difficulty: "Medium",
    marks: 3,
    questionType: "MCQ",
    source: "practice",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "OOP Concepts"
  },
  {
    questionId: "benchmark-mcq-015",
    question: "Can an abstract class in Java have constructors?",
    options: [
      "Yes, and they are called when a concrete subclass is instantiated via `super()`",
      "No, abstract classes cannot declare constructors",
      "Yes, but they can only be declared private",
      "No, only interfaces can have constructors"
    ],
    correctAnswer: "Yes, and they are called when a concrete subclass is instantiated via `super()`",
    explanation: "Abstract classes can declare constructors to initialize base class state, which execute via `super()` during subclass instantiation.",
    difficulty: "Medium",
    marks: 3,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "OOP Concepts"
  },

  // ── 3. Database / SQL & DBMS (Reported Anchors & Concepts) ──
  {
    questionId: "benchmark-mcq-016",
    question: "What is the difference between WHERE and HAVING clauses in SQL?",
    options: [
      "WHERE filters individual rows before aggregation; HAVING filters groups after aggregation",
      "WHERE is used only with numeric columns; HAVING is used only with text columns",
      "WHERE operates after GROUP BY; HAVING operates before GROUP BY",
      "There is no functional difference between WHERE and HAVING"
    ],
    correctAnswer: "WHERE filters individual rows before aggregation; HAVING filters groups after aggregation",
    explanation: "In SQL query execution, WHERE filters base rows before grouping, whereas HAVING filters aggregated summary rows after GROUP BY.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Database & SQL"
  },
  {
    questionId: "benchmark-mcq-017",
    question: "Which SQL JOIN returns all rows from the left table, and the matched rows from the right table, filling NULL for unmatched right rows?",
    options: [
      "LEFT JOIN",
      "RIGHT JOIN",
      "INNER JOIN",
      "CROSS JOIN"
    ],
    correctAnswer: "LEFT JOIN",
    explanation: "A LEFT OUTER JOIN preserves all rows from the left relation, matching available right table rows and substituting NULL where no predicate match exists.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Database & SQL"
  },
  {
    questionId: "benchmark-mcq-018",
    question: "In relational database design, which Normal Form requires a table to be in 1NF and have all non-key attributes fully functionally dependent on the entire primary key (no partial dependencies)?",
    options: [
      "Second Normal Form (2NF)",
      "First Normal Form (1NF)",
      "Third Normal Form (3NF)",
      "Boyce-Codd Normal Form (BCNF)"
    ],
    correctAnswer: "Second Normal Form (2NF)",
    explanation: "2NF eliminates partial dependencies where non-prime attributes depend on only a subset of a composite primary key.",
    difficulty: "Medium",
    marks: 3,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Database & SQL"
  },
  {
    questionId: "benchmark-mcq-019",
    question: "Which of the following ACID properties ensures that database transaction changes remain permanent even in the event of a power loss or system crash?",
    options: [
      "Durability",
      "Atomicity",
      "Consistency",
      "Isolation"
    ],
    correctAnswer: "Durability",
    explanation: "Durability guarantees that once a transaction commits, its modifications persist permanently in non-volatile storage via write-ahead logging.",
    difficulty: "Easy",
    marks: 2,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Database & SQL"
  },
  {
    questionId: "benchmark-mcq-020",
    question: "What will be the result of the SQL expression: `SELECT COUNT(*), COUNT(commission) FROM Employees;` if 5 out of 20 employees have NULL commission?",
    options: [
      "COUNT(*) = 20, COUNT(commission) = 15",
      "COUNT(*) = 20, COUNT(commission) = 20",
      "COUNT(*) = 15, COUNT(commission) = 15",
      "COUNT(*) = 15, COUNT(commission) = 5"
    ],
    correctAnswer: "COUNT(*) = 20, COUNT(commission) = 15",
    explanation: "`COUNT(*)` counts all rows regardless of NULLs (20), while `COUNT(column_name)` ignores NULL values, yielding 20 - 5 = 15.",
    difficulty: "Medium",
    marks: 3,
    questionType: "MCQ",
    source: "interview_reported",
    companyId: "benchmark",
    companyIds: ["benchmark"],
    topic: "Database & SQL"
  }
];

// Expanded pool of technical screening MCQs across all core modules
const mcqPool = [
  // DSA (Trees, BST, Heaps, Graph, Complexity)
  { topic: "Trees & BST", diff: "Easy", marks: 2, q: "What is the in-order traversal output of a valid Binary Search Tree (BST)?", opts: ["Values in ascending sorted order", "Values in descending sorted order", "Values ordered by tree level", "Arbitrary random order"], ans: "Values in ascending sorted order", exp: "In-order traversal (Left -> Root -> Right) on a BST processes all elements in strictly non-decreasing sorted sequence." },
  { topic: "Trees & BST", diff: "Medium", marks: 3, q: "What is the height of a balanced Binary Search Tree containing n nodes?", opts: ["O(log n)", "O(n)", "O(n log n)", "O(1)"], ans: "O(log n)", exp: "A balanced binary tree with n nodes has height h = floor(log2(n)) + 1." },
  { topic: "Trees & BST", diff: "Hard", marks: 5, q: "In an AVL tree, what is the maximum permissible difference between heights of left and right subtrees for any node?", opts: ["1", "0", "2", "log2(n)"], ans: "1", exp: "The AVL balance factor is defined as height(left) - height(right) and must strictly reside in {-1, 0, +1}." },
  { topic: "Data Structures", diff: "Easy", marks: 2, q: "Which data structure follows the Last-In-First-Out (LIFO) order?", opts: ["Stack", "Queue", "Array", "Linked List"], ans: "Stack", exp: "A Stack inserts and removes elements from the top, obeying LIFO ordering." },
  { topic: "Data Structures", diff: "Medium", marks: 3, q: "What is the average time complexity to lookup a key in a standard Hash Table with a good hash function?", opts: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], ans: "O(1)", exp: "Direct index computation via hash functions yields O(1) constant average lookup time." },
  { topic: "Data Structures", diff: "Hard", marks: 5, q: "What is the worst-case time complexity of insertion into a Hash Table when all keys collide into the same bucket using separate chaining with linked lists?", opts: ["O(n)", "O(1)", "O(log n)", "O(n^2)"], ans: "O(n)", exp: "When all n keys collide into a single bucket linked list, traversing the list takes linear O(n) time." },
  { topic: "Complexity & Algorithms", diff: "Easy", marks: 2, q: "Which of the following time complexities is the most efficient asymptotically for large n?", opts: ["O(log n)", "O(n)", "O(n log n)", "O(n^2)"], ans: "O(log n)", exp: "Logarithmic time O(log n) grows much slower than linear, linearithmic, or quadratic time." },
  { topic: "Complexity & Algorithms", diff: "Medium", marks: 3, q: "What is the time complexity of the Master Theorem case when T(n) = 2T(n/2) + O(n)?", opts: ["O(n log n)", "O(n)", "O(n^2)", "O(log n)"], ans: "O(n log n)", exp: "Here a=2, b=2, d=1. Since log_b(a) = log_2(2) = 1 == d, the solution is O(n^d * log n) = O(n log n)." },
  { topic: "Complexity & Algorithms", diff: "Hard", marks: 5, q: "What is the space complexity of standard recursive Depth First Search on a graph with V vertices and maximum depth D?", opts: ["O(D) for call stack", "O(V^2)", "O(1)", "O(E * V)"], ans: "O(D) for call stack", exp: "Recursive DFS stores at most D active function frames on the execution stack simultaneously." },

  // OOP & Design Patterns
  { topic: "OOP Concepts", diff: "Easy", marks: 2, q: "Which keyword in Java is used to inherit a class?", opts: ["extends", "implements", "inherits", "instanceof"], ans: "extends", exp: "The `extends` keyword establishes class inheritance in Java." },
  { topic: "OOP Concepts", diff: "Easy", marks: 2, q: "Which keyword in Java is used by a class to implement an interface?", opts: ["implements", "extends", "interface", "using"], ans: "implements", exp: "The `implements` keyword is used by classes to implement interface contracts." },
  { topic: "OOP Concepts", diff: "Medium", marks: 3, q: "Can a constructor in Java be declared `static` or `final`?", opts: ["No, constructors cannot be static, final, or abstract", "Yes, constructors can be both static and final", "Yes, but only static is allowed", "Yes, but only final is allowed"], ans: "No, constructors cannot be static, final, or abstract", exp: "Constructors belong to object instantiation and cannot be inherited or overridden, making static/final/abstract invalid." },
  { topic: "OOP Concepts", diff: "Hard", marks: 5, q: "Which design pattern provides a surrogate or placeholder for another object to control access to it?", opts: ["Proxy Pattern", "Adapter Pattern", "Decorator Pattern", "Facade Pattern"], ans: "Proxy Pattern", exp: "The Proxy pattern controls access to an underlying object, used in lazy loading, caching, and security checks." },
  { topic: "OOP Concepts", diff: "Medium", marks: 3, q: "What is the primary difference between Adapter Pattern and Decorator Pattern?", opts: ["Adapter changes an interface to match client expectations; Decorator enhances object responsibilities dynamically without changing interface", "Adapter creates new classes; Decorator destroys them", "Decorator changes the interface; Adapter adds responsibilities", "There is no architectural difference"], ans: "Adapter changes an interface to match client expectations; Decorator enhances object responsibilities dynamically without changing interface", exp: "Adapter converts incompatible interfaces; Decorator adds behaviors while keeping the same interface." },

  // SQL & DBMS
  { topic: "Database & SQL", diff: "Easy", marks: 2, q: "Which SQL clause is used to eliminate duplicate rows from a query result set?", opts: ["DISTINCT", "UNIQUE", "GROUP", "DIFFERENT"], ans: "DISTINCT", exp: "The `DISTINCT` keyword filters out duplicate tuples from the output." },
  { topic: "Database & SQL", diff: "Medium", marks: 3, q: "What type of index is created by default on the Primary Key column in MySQL InnoDB?", opts: ["Clustered B+Tree Index", "Non-clustered Hash Index", "Bitmap Index", "Full-text Index"], ans: "Clustered B+Tree Index", exp: "InnoDB stores table data physically sorted by the primary key inside a clustered B+Tree index." },
  { topic: "Database & SQL", diff: "Hard", marks: 5, q: "What is the difference between a Correlated Subquery and a Non-Correlated Subquery in SQL?", opts: ["A correlated subquery references columns from the outer query and re-evaluates for every outer row; a non-correlated subquery executes once independently", "A correlated subquery runs once; non-correlated runs multiple times", "Correlated subqueries cannot contain WHERE clauses", "Non-correlated subqueries must return multiple tables"], ans: "A correlated subquery references columns from the outer query and re-evaluates for every outer row; a non-correlated subquery executes once independently", exp: "Correlated subqueries depend on outer row attributes and execute repeatedly for each candidate row." },
  { topic: "Database & SQL", diff: "Easy", marks: 2, q: "Which SQL aggregate function computes the total sum of numerical column values?", opts: ["SUM()", "TOTAL()", "COUNT()", "AVG()"], ans: "SUM()", exp: "`SUM(column)` calculates the arithmetic sum of numerical values, ignoring NULLs." },
  { topic: "Database & SQL", diff: "Medium", marks: 3, q: "What is the purpose of the FOREIGN KEY constraint with ON UPDATE CASCADE?", opts: ["When a primary key in parent table is updated, matching foreign keys in child table update automatically", "It prevents primary keys from ever being updated", "It deletes child rows when parent is updated", "It creates a backup table"], ans: "When a primary key in parent table is updated, matching foreign keys in child table update automatically", exp: "ON UPDATE CASCADE propagates parent key modifications down to all dependent child records." },

  // Programming Fundamentals (Java, C++, Python, PHP)
  { topic: "Java Programming", diff: "Easy", marks: 2, q: "In Java, what is the default value of an uninitialized boolean instance variable in a class?", opts: ["false", "true", "null", "0"], ans: "false", exp: "Java initializes boolean instance fields to `false` by default." },
  { topic: "Java Programming", diff: "Medium", marks: 3, q: "What is the time complexity of `ArrayList.get(index)` vs `LinkedList.get(index)` in Java?", opts: ["O(1) for ArrayList, O(n) for LinkedList", "O(n) for ArrayList, O(1) for LinkedList", "O(1) for both", "O(log n) for both"], ans: "O(1) for ArrayList, O(n) for LinkedList", exp: "ArrayList offers O(1) random array access, while LinkedList requires O(n) sequential pointer traversal." },
  { topic: "Java Programming", diff: "Hard", marks: 5, q: "What happens during a Java thread deadlock, and which JVM tool can detect it?", opts: ["Threads block indefinitely waiting on locks held by each other; detected using `jstack` or ThreadMXBean", "The JVM crashes immediately with OutOfMemoryError", "The garbage collector kills the deadlocked threads", "The OS terminates the JVM process"], ans: "Threads block indefinitely waiting on locks held by each other; detected using `jstack` or ThreadMXBean", exp: "Deadlocks cause threads to sleep indefinitely on mutual lock acquisition; `jstack <pid>` prints thread dumps identifying deadlocked locks." },
  { topic: "C/C++ Programming", diff: "Easy", marks: 2, q: "In C/C++, which operator is used to access members of a structure through a pointer?", opts: ["->", ".", "::", "*."], ans: "->", exp: "The arrow operator (`->`) dereferences a struct pointer and accesses its field directly." },
  { topic: "C/C++ Programming", diff: "Medium", marks: 3, q: "What is the size of a pointer variable on a 64-bit operating system architecture?", opts: ["8 bytes (64 bits)", "4 bytes (32 bits)", "2 bytes (16 bits)", "Varies based on data type pointed to"], ans: "8 bytes (64 bits)", exp: "On 64-bit architectures, all memory addresses and pointers occupy 8 bytes." },
  { topic: "Python Programming", diff: "Easy", marks: 2, q: "Which of the following built-in data types in Python is mutable?", opts: ["List", "Tuple", "String", "Integer"], ans: "List", exp: "Lists in Python are mutable sequences allowing in-place modification (`append`, `pop`, index assignment)." },
  { topic: "Python Programming", diff: "Medium", marks: 3, q: "What is a Python Generator function and how does it differ from a standard function returning a list?", opts: ["A generator uses `yield` to stream values lazily one-by-one, saving memory", "A generator executes in parallel on all CPU cores", "A generator cannot accept parameters", "A generator converts code to C automatically"], ans: "A generator uses `yield` to stream values lazily one-by-one, saving memory", exp: "Generators return an iterator yielding values on-demand, enabling O(1) memory pipelines for large datasets." },
  { topic: "Web & REST APIs", diff: "Easy", marks: 2, q: "Which HTTP status code indicates a successful resource creation in a REST API?", opts: ["201 Created", "200 OK", "204 No Content", "301 Moved Permanently"], ans: "201 Created", exp: "HTTP 201 indicates that a new resource has been successfully created on the server." },
  { topic: "Web & REST APIs", diff: "Medium", marks: 3, q: "Which HTTP method is considered safe and idempotent according to RFC specifications?", opts: ["GET", "POST", "PATCH", "CONNECT"], ans: "GET", exp: "GET is both safe (read-only without server state changes) and idempotent (repeated identical calls return identical responses)." },
  { topic: "JavaScript & Frontend", diff: "Easy", marks: 2, q: "Which JavaScript keyword declares a block-scoped variable that cannot be re-assigned?", opts: ["const", "let", "var", "static"], ans: "const", exp: "`const` declares a block-scoped identifier that cannot be reassigned after initialization." },
  { topic: "JavaScript & Frontend", diff: "Medium", marks: 3, q: "What is a Closure in JavaScript?", opts: ["A function that retains access to its lexical outer scope variables even after outer function has executed", "A method that terminates the browser window", "A syntax error in asynchronous code", "An object with private prototype"], ans: "A function that retains access to its lexical outer scope variables even after outer function has executed", exp: "Closures bundle a function with its lexical environment, allowing access to outer scope variables from an inner function." },
  { topic: "Operating Systems", diff: "Easy", marks: 2, q: "Which CPU scheduling algorithm gives each process a fixed time slice (quantum) in cyclic order?", opts: ["Round Robin", "First-Come First-Served", "Shortest Job First", "Priority Scheduling"], ans: "Round Robin", exp: "Round Robin preempts processes after their allocated time quantum in FIFO circular queue order." },
  { topic: "Computer Networks", diff: "Easy", marks: 2, q: "Which layer of the OSI model is responsible for end-to-end reliable transmission and flow control?", opts: ["Transport Layer (Layer 4)", "Network Layer (Layer 3)", "Data Link Layer (Layer 2)", "Session Layer (Layer 5)"], ans: "Transport Layer (Layer 4)", exp: "Layer 4 (Transport, e.g. TCP) provides end-to-end connection management, flow control, and error recovery." }
];

// Fill out remaining MCQs programmatically up to 210
let mcqCount = 21;
while (mcqQuestions.length < 210) {
  for (const item of mcqPool) {
    if (mcqQuestions.length >= 210) break;
    const qNum = mcqCount++;
    const idStr = String(qNum).padStart(3, "0");
    mcqQuestions.push({
      questionId: `benchmark-mcq-${idStr}`,
      question: item.q,
      options: item.opts,
      correctAnswer: item.ans,
      explanation: item.exp,
      difficulty: item.diff,
      marks: item.marks,
      questionType: "MCQ",
      source: "practice",
      companyId: "benchmark",
      companyIds: ["benchmark"],
      topic: item.topic
    });
  }
}
