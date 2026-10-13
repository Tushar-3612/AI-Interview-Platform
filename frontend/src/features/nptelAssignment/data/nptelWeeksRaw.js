/**
 * NPTEL Assignment Question Bank - Raw Weeks Source
 */

export const NPTEL_WEEKS = [
  {
    weekId: "week-1",
    weekNumber: 1,
    title: "Foundations of Research & PhD Degree",
    badge: "Fundamentals",
    questions: [
      {
        id: "q1",
        questionText: "What sets a PhD apart from other degrees?",
        points: 1,
        type: "multiple",
        options: [
          "Focus on practical skills and hands-on experience.",
          "Development of critical thinking and analytical abilities.",
          "Preparation to guide others in pursuing a PhD.",
          "Completion of coursework and examinations."
        ],
        correctAnswers: [
          "Development of critical thinking and analytical abilities.",
          "Preparation to guide others in pursuing a PhD."
        ],
        explanation: "A PhD specifically develops advanced critical thinking and independent analytical abilities, while training scholars with the intellectual rigor needed to guide future researchers."
      },
      {
        id: "q2",
        questionText: "What distinguishes a research-based degree from a typical undergraduate degree?",
        points: 1,
        type: "single",
        options: [
          "Clear and defined boundaries throughout the degree program.",
          "Opportunities for continuous discovery and learning.",
          "Graduation day marking the completion of the degree.",
          "Acquisition of expertise and recognition in a specific field."
        ],
        correctAnswers: [
          "Opportunities for continuous discovery and learning."
        ],
        explanation: "Unlike coursework with predefined boundaries and fixed syllabi, research-based degrees provide open-ended opportunities for continuous discovery and exploration."
      },
      {
        id: "q3",
        questionText: "What is the importance of attitude and communication in the student-advisor relationship?",
        points: 1,
        type: "single",
        options: [
          "Having prior knowledge is the most important factor for a student to work towards a PhD.",
          "Advisors expect students to define their own research problems without any guidance.",
          "Students should choose advisors based on their reputation and availability.",
          "Attitude, inclination to learn, and effective communication with the advisor are crucial."
        ],
        correctAnswers: [
          "Attitude, inclination to learn, and effective communication with the advisor are crucial."
        ],
        explanation: "Productive research relationships rely fundamentally on positive learning attitude, open feedback loops, and proactive communication."
      },
      {
        id: "q4",
        questionText: "What makes research challenging for first-time researchers?",
        points: 1,
        type: "single",
        options: [
          "The need to handle routine work and drudgery.",
          "The sudden shift in patterns from coursework to research.",
          "The discovery process involved in understanding the research process.",
          "The pressure to obtain a degree and complete the research process."
        ],
        correctAnswers: [
          "The sudden shift in patterns from coursework to research."
        ],
        explanation: "First-time researchers transition abruptly from structured, syllabus-bound coursework to ambiguous, self-directed investigative research."
      },
      {
        id: "q5",
        questionText: "What is one advantage of research when dealing with failure?",
        points: 1,
        type: "single",
        options: [
          "Research allows for changing initial assumptions and exploring different approaches.",
          "Research ensures that failures are minimized and success is guaranteed.",
          "Research provides a predefined path to follow, for sure eliminating the possibility of failure.",
          "Research discourages any changes in assumptions or approaches to maintain consistency."
        ],
        correctAnswers: [
          "Research allows for changing initial assumptions and exploring different approaches."
        ],
        explanation: "In research, an unexpected negative result or failure provides valuable data to question assumptions, revise hypotheses, and try new approaches."
      },
      {
        id: "q6",
        questionText: "When conducting experiments and analysing results in research:",
        points: 1,
        type: "single",
        options: [
          "Each individual step will always lead to something significant.",
          "The familiarity with the area helps in building experiments, but the results are often insignificant.",
          "Day-to-day experiments and results are usually significant and groundbreaking.",
          "Small steps are taken, and over time they contribute to something significant."
        ],
        correctAnswers: [
          "Small steps are taken, and over time they contribute to something significant."
        ],
        explanation: "Scientific research advances cumulatively: steady, measured, daily iterations aggregate into significant discoveries."
      },
      {
        id: "q7",
        passageTitle: "Engineers and Scientists",
        passage: "We live in a world that is filled with a wide range of technologies that we use and we take for granted. The speed with which new technologies appear and disappear is constantly increasing. These days many of the gadgets we buy get outdated in a time frame of two to three years. This is a short time frame since many of the technologies in use are robust enough to physically last several years. However, in terms of features and utility, they get outdated much sooner than that. This is also a short time frame relative to how long technologies were used two or three decades ago. An example is the media used to store music. While gramophone records and cassettes lasted decades, DVDs have fast disappeared. Almost any mobile phone or computer purchased these days become obsolete in two to three years.\n\nBehind this vast moving world of technologies, is a worldwide army of scientists and engineers. They are constantly on the prowl for making advances to existing technologies. Many industries, companies, and educational institutions are filled with scientists and engineers. While there may be some similarities in the tasks they are involved in, there are also some differences.\n\nAn engineer in an industry setting usually faces several technical trouble shooting challenges. Such challenges, with stiff timelines, require substantial familiarity with information databases, and characterization techniques, to be successfully addressed. Addressing trouble shooting challenges are often based on the selection and use of the best available resources and substitutes. The types of questions the engineer is faced with include questions of the sort:\n\n1. Is there a lighter material readily available which can replace the existing material in the product?\n2. Why is a specific batch of the product not as good as another batch?\n3. Will it be possible for this product to function with lesser parts than it currently has?\nAnswers to such questions enable the industry meet the demands of their customers at lower costs and with greater reliability.\n\nA scientist in a university or laboratory setting faces a different kind of challenge. The questions the scientist wishes to answer are:\n1. Why is the value of any specific property of a material what it is?\n2. What is the fundamental science behind the property?\n3. What are the limits, if any, to this property?\nAnswers to such questions enable one to design new materials and to push the capabilities of existing materials.\n\nBased on the professional setting a materials specialist ends up in, he/she will likely get pulled into one of the above types of activities. However, having both - a good feel for the fundamental sciences, as well as an understanding of the engineering approach to relate to the real world, can greatly enhance the value of a materials scientist/engineer to his or organization.",
        questionText: "Technologies in use today have life span of decades",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["False"],
        explanation: "As stated in the passage, gadgets and technologies get outdated in a time frame of two to three years, in contrast to earlier decades."
      },
      {
        id: "q8",
        passageTitle: "Engineers and Scientists",
        passage: "Refer to the 'Engineers and Scientists' passage above.",
        questionText: "Engineers aim to reduce the number of parts in a product",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["True"],
        explanation: "The passage explicitly notes that engineers ask: 'Will it be possible for this product to function with lesser parts than it currently has?' to lower costs and boost reliability."
      },
      {
        id: "q9",
        passageTitle: "Global Warming",
        passage: "Global warming refers to the idea that the temperature of the planet is, on average, increasing. It is a topic of considerable discussion and debate internationally because there are differing views on the severity of the phenomenon, the cause for the phenomenon, remedial measures to be considered and the financial impact of such remedial measures.\n\nThere is very strong experimental evidence that global warming is a real phenomenon. 10 of the hottest years recorded in history have all occurred in the last 15 years or so.\n\nThere is also strong reason to believe that the amount of carbon dioxide in the atmosphere, directly impacts the raise in temperature observed globally. This evidence can be seen in the strong correlation between temperature and atmospherical carbon dioxide data collected in the past nearly 60 years, as well as in the temperature and carbon dioxide data that can be obtained for more than 100,000 years, from ice core samples obtained from Antarctica.\n\nBased on energy usage patterns as well as the amount of carbon dioxide released as a function of the energy usage, it is possible to see how human activity can impact carbon dioxide content in the atmosphere in a significant manner. In fact a simple calculation will show that with the present level of energy usage, assuming all of it is from crude oil, the amount of carbon dioxide in the atmosphere will double in less than 100 years.\n\nIn addition to carbon dioxide, there are other gases as well that can accelerate global warming, some much more severely than carbon dioxide. However in terms of sheer quantity in the atmosphere, carbon dioxide is the most significant contributor to global warming.\n\nThe controversy over what needs to be done to combat global warming, is purely one of short term economic impact. Nations which release the most carbon dioxide total, as well the most carbon dioxide per-capita, are both reluctant to take measures to curb the release of carbon dioxide since it impacts quality of life of their populations in the short term. However there is grave danger in assuming such a short term outlook to this issue. If this issue is not addressed urgently, the planet may become unliveable in a relatively short time and at that point, with the very existence of humanity in question, it will look completely absurd to place a few comforts above survival of the planet.\n\nNature controls us indirectly by causing severe weather patterns that shut down cities for days and months. It is much more prudent that we address this issue on our initiative rather than wait for nature to complete the arguments in this context.",
        questionText: "Global warming is only a theoretical phenomenon",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["False"],
        explanation: "The passage notes that there is very strong empirical and experimental evidence that global warming is an active physical reality."
      },
      {
        id: "q10",
        passageTitle: "Global Warming",
        passage: "Refer to the 'Global Warming' passage above.",
        questionText: "Carbon dioxide in the atmosphere contributes to global warming",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["True"],
        explanation: "As detailed in the passage, carbon dioxide in terms of sheer atmospheric quantity is the most significant contributor to global warming."
      }
    ]
  },
  {
    weekId: "week-2",
    weekNumber: 2,
    title: "Literature Survey & Archival Sources",
    badge: "Information Retrieval",
    questions: [
      {
        id: "q11",
        questionText: "Experimental data generated from a setup must validate the theoretical predictions or models designed for that setup",
        points: 1,
        type: "single",
        options: ["True", "False", "Sometimes", "Never"],
        correctAnswers: ["Sometimes"],
        explanation: "Experiments do not always validate models due to experimental errors, incomplete model assumptions, unmodeled physical phenomena, or novel findings."
      },
      {
        id: "q12",
        questionText: "Literature survey is important because",
        points: 1,
        type: "multiple",
        options: [
          "It helps in getting a summary of work that has been done till date in some particular research area",
          "It is helpful in ensuring that a research work is not getting repeated",
          "It is helpful in understanding the approaches taken by scientists and what are the gaps in the processes",
          "It is helpful in clarifying the controversial results that one can get"
        ],
        correctAnswers: [
          "It helps in getting a summary of work that has been done till date in some particular research area",
          "It is helpful in ensuring that a research work is not getting repeated",
          "It is helpful in understanding the approaches taken by scientists and what are the gaps in the processes",
          "It is helpful in clarifying the controversial results that one can get"
        ],
        explanation: "A comprehensive literature survey achieves all four functions: state-of-the-art summary, avoiding duplication, identifying research gaps, and resolving conflicting findings."
      },
      {
        id: "q13",
        questionText: "Which of the following methods of searching for literature is suitable to identify the earliest contributor of a scientific outcome?",
        points: 1,
        type: "single",
        options: [
          "Keyword based search followed by sorting by year of publication",
          "Citation based search followed by sorting by year of publication",
          "Keyword based search followed by sorting by citations",
          "Back reference based search following a keyword based search"
        ],
        correctAnswers: [
          "Back reference based search following a keyword based search"
        ],
        explanation: "Following backwards citations ('back reference' chaining) through referenced papers traces the lineage back to the seminal, earliest source paper."
      },
      {
        id: "q14",
        questionText: "Which of the following bibliographic details is a sufficient and unique piece of information to locate an article in an archival journal?",
        points: 1,
        type: "single",
        options: ["ISSN", "DOI", "Page Number", "Volume Number"],
        correctAnswers: ["DOI"],
        explanation: "A Digital Object Identifier (DOI) is a globally unique persistent identifier assigned specifically to an individual publication."
      },
      {
        id: "q15",
        questionText: "Which of the following is always true for an open access journal?",
        points: 1,
        type: "single",
        options: [
          "Such journals are not peer reviewed",
          "Articles in such a journal are freely available for download",
          "Such journals charge for publication of an article",
          "Such journals are of dubious reputation"
        ],
        correctAnswers: [
          "Articles in such a journal are freely available for download"
        ],
        explanation: "By definition, open access articles are freely accessible to the public without subscription barriers."
      },
      {
        id: "q16",
        questionText: "Which of the following is NOT a recommended practice to identify publications that need to be listed under references of an article?",
        points: 1,
        type: "single",
        options: [
          "Relevant publications actually referred to",
          "Latest publications by the editor of the journal",
          "Original publications in the topic of the article",
          "Own publications referred in the article for further details"
        ],
        correctAnswers: [
          "Latest publications by the editor of the journal"
        ],
        explanation: "Citing an editor's publications simply to appease or curry favor with the journal editor is unethical and not academically recommended."
      },
      {
        id: "q17",
        questionText: "Which of the following indices is considered as a measure of the impact of a particular author in its area of his/her specialization?",
        points: 1,
        type: "single",
        options: [
          "Total number of articles published",
          "Hirsch index of the author",
          "Number of views of his/her latest article",
          "Number of downloads of all articles in a year"
        ],
        correctAnswers: ["Hirsch index of the author"],
        explanation: "The Hirsch index (h-index) quantifies an author's scholarly impact by combining productivity (number of papers) and citation impact."
      },
      {
        id: "q18",
        questionText: "The following are categorized as primary source for literature survey",
        points: 1,
        type: "multiple",
        options: [
          "Periodicals & research reports",
          "Conference proceedings & official publications",
          "Compilations & reviews",
          "Directories & year books"
        ],
        correctAnswers: [
          "Periodicals & research reports",
          "Conference proceedings & official publications"
        ],
        explanation: "Primary sources present original research first-hand (journal periodicals, research reports, conference proceedings)."
      },
      {
        id: "q19",
        questionText: "The abstracting databases for systematic manual searches include",
        points: 1,
        type: "multiple",
        options: [
          "INSPEC and COMPENDEX",
          "PubMed",
          "Wikipedia",
          "Chemical Abstract (CA) service"
        ],
        correctAnswers: [
          "INSPEC and COMPENDEX",
          "PubMed",
          "Chemical Abstract (CA) service"
        ],
        explanation: "INSPEC, COMPENDEX, PubMed, and Chemical Abstracts are indexed, curated academic bibliographic databases."
      },
      {
        id: "q20",
        questionText: "Consider that you have collected the following resources towards your research:\n\n(1) A reference in a journal article that you have not referred yet\n(2) A link to the website of a professional society\n(3) A published article with journal, year, volume and page number\n(4) An article from a newly launched journal with volume number, page number but year and ISSN number are due\n(5) A newly accepted journal article with DOI link\n(6) A book with an ISBN number available\n\nWhich of the following can be considered as archival (valuable record) references for inclusion in a publication?",
        points: 1,
        type: "single",
        options: [
          "Only 1, 2 and 3",
          "Only 3, 5 and 6",
          "Only 3, 4 and 6",
          "Only 1, 2 and 5"
        ],
        correctAnswers: ["Only 3, 5 and 6"],
        explanation: "Items 3 (fully cited published article), 5 (accepted article with permanent DOI), and 6 (book with ISBN) constitute verified, archival scholarly references."
      }
    ]
  },
  {
    weekId: "week-3",
    weekNumber: 3,
    title: "Laboratory Safety & Error Analysis",
    badge: "Experimental Discipline",
    questions: [
      {
        id: "q21",
        questionText: "Safety must be the most important discipline of our routine when we are in laboratory or industrial environment. The common sources which have potential to cause damage, available in our lab towards which we need to be careful are-",
        points: 1,
        type: "multiple",
        options: [
          "Sources of heat",
          "Chemicals (Acids, Bases etc.)",
          "Pressurized gas cylinders",
          "Electricity and water source"
        ],
        correctAnswers: [
          "Sources of heat",
          "Chemicals (Acids, Bases etc.)",
          "Pressurized gas cylinders",
          "Electricity and water source"
        ],
        explanation: "Thermal sources, toxic or corrosive chemicals, high-pressure gas cylinders, and electrical/water connections are all common lab hazards requiring vigilance."
      },
      {
        id: "q22",
        questionText: "Which of the following statistics is used to quantify errors in parameter estimates?",
        points: 1,
        type: "single",
        options: ["Mode", "Skewness", "Standard deviation", "Median"],
        correctAnswers: ["Standard deviation"],
        explanation: "Standard deviation (and standard error) measures the dispersion of parameter estimates around the expected value."
      },
      {
        id: "q23",
        questionText: "A temperature sensor is installed at the bottom of the cooling tower storage tank to measure the temperature of outlet water. The sensor did not function properly for some time and gave data with higher temperature values. The conclusion we can draw from the process is-",
        points: 1,
        type: "single",
        options: [
          "Since data with different values were recorded, this increased the possibility of wide analysis thus very useful for our work",
          "The data obtained cannot be reliable because these are not true data from the system but the malfunctioned one",
          "The data can be used as with good accuracy using the predictive type data analysis where we can assume the extent of error and finally subtract the error from final value",
          "None of these"
        ],
        correctAnswers: [
          "The data obtained cannot be reliable because these are not true data from the system but the malfunctioned one"
        ],
        explanation: "Data generated during a sensor malfunction reflects equipment defect rather than underlying physical system state, making it fundamentally unreliable."
      },
      {
        id: "q24",
        questionText: "Which of the following can be treated as deterministic signals?",
        points: 1,
        type: "single",
        options: [
          "Measurements of atmospheric temperature",
          "A sine wave corrupted by a rectangular pulse",
          "Estimates of signals from measurements",
          "None of the above"
        ],
        correctAnswers: ["A sine wave corrupted by a rectangular pulse"],
        explanation: "A combination of a mathematical sine wave and a deterministic rectangular pulse can be completely described by explicit mathematical functions."
      },
      {
        id: "q25",
        questionText: "Identify the incorrect statement(s) among the following w.r.t. non-linear models.",
        points: 1,
        type: "multiple",
        options: [
          "Linearization involves mere discarding of the non-linear terms in a model.",
          "The standard Taylor's series-based linearized model changes with the nominal point of linearization.",
          "A non-linear model can never yield a zero-valued output to a non-zero input.",
          "Estimates of linear models have smaller errors than those of non-linear models."
        ],
        correctAnswers: [
          "Linearization involves mere discarding of the non-linear terms in a model.",
          "A non-linear model can never yield a zero-valued output to a non-zero input.",
          "Estimates of linear models have smaller errors than those of non-linear models."
        ],
        explanation: "Linearization requires Taylor series expansion around an operating point (not mere discarding); non-linear models can have roots at non-zero inputs; and error magnitudes depend on data/noise rather than linearity."
      },
      {
        id: "q26",
        questionText: "Which of the following transforms are used to detect periodic (oscillatory) components in a signal?",
        points: 1,
        type: "single",
        options: ["Hilbert transform", "z-transform", "Fourier transform", "All of the above"],
        correctAnswers: ["Fourier transform"],
        explanation: "The Fourier transform decomposes signals into constituent sinusoidal frequencies, revealing periodic/oscillatory spectral peaks."
      },
      {
        id: "q27",
        questionText: "The ratio of errors in parameter estimates of a model from two data sets with SNR 9 and 100 is",
        points: 1,
        type: "single",
        options: ["3 : 10", "5 : 1", "10 : 3", "10 : 0.9"],
        correctAnswers: ["10 : 3"],
        explanation: "Error standard deviation is inversely proportional to sqrt(SNR). Thus, error ratio = sqrt(100) / sqrt(9) = 10 / 3 = 10 : 3."
      },
      {
        id: "q28",
        questionText: "Which of the following is true concerning a parameter estimate?",
        points: 1,
        type: "single",
        options: [
          "It is in general close to the true value with high probability.",
          "When averaged across a million experimental records under same operating conditions, the estimate equals the true value.",
          "Least squares method always gives the estimate with lowest error.",
          "It is a mathematical function of the observations."
        ],
        correctAnswers: ["It is a mathematical function of the observations."],
        explanation: "By definition in statistical estimation theory, an estimator/estimate is a mathematical function (statistic) computed from the observed data sample."
      },
      {
        id: "q29",
        questionText: "Which of the following statements is true?",
        points: 1,
        type: "multiple",
        options: [
          "Deterministic phenomena produce outcomes that can be predicted accurately.",
          "Random processes occur randomly.",
          "A process can produce a mix of deterministic and stochastic effects.",
          "Signals that are random can never take negative values."
        ],
        correctAnswers: [
          "Deterministic phenomena produce outcomes that can be predicted accurately.",
          "A process can produce a mix of deterministic and stochastic effects."
        ],
        explanation: "Deterministic processes yield exact predictable outputs. In real systems, processes often combine underlying deterministic dynamics with stochastic noise."
      },
      {
        id: "q30",
        questionText: "An estimator is said to be most efficient when",
        points: 1,
        type: "single",
        options: [
          "The parameters can be estimated in the least possible time.",
          "The estimator provides accurate estimates with the smallest number of observations.",
          "Standard error in the parameter estimates is lowest when compared to that of all other estimators.",
          "It estimates parameters accurately even in presence of outliers."
        ],
        correctAnswers: [
          "Standard error in the parameter estimates is lowest when compared to that of all other estimators."
        ],
        explanation: "In estimation theory, efficiency refers to achieving the minimum possible variance / standard error among unbiased estimators."
      }
    ]
  },
  {
    weekId: "week-4",
    weekNumber: 4,
    title: "Technical Writing & Visual Communication",
    badge: "Scholarly Communication",
    questions: [
      {
        id: "q31",
        questionText: "The title of a paper is ‘Battery design and its impact’. This title",
        points: 1,
        type: "multiple",
        options: [
          "Identifies the area of research clearly",
          "Indicates what is unique about the research",
          "Does not identify the area of the research clearly",
          "Does not indicate what is unique about the research"
        ],
        correctAnswers: [
          "Does not identify the area of the research clearly",
          "Does not indicate what is unique about the research"
        ],
        explanation: "The title is excessively vague: 'Battery design' doesn't specify chemistry, scale, or application, and 'its impact' fails to identify what is unique about the contribution."
      },
      {
        id: "q32",
        questionText: "In images",
        points: 1,
        type: "single",
        options: [
          "High magnification implies high resolution",
          "High magnification does not necessarily imply high resolution",
          "Low magnification implies high resolution",
          "High resolution implies low magnification"
        ],
        correctAnswers: ["High magnification does not necessarily imply high resolution"],
        explanation: "Magnification simply enlarges the image scale; resolution depends on the optical wavelength, numerical aperture, and sensor quality."
      },
      {
        id: "q33",
        questionText: "Tables are preferred over graphs",
        points: 1,
        type: "single",
        options: [
          "Always",
          "Never",
          "Only when exact values need to be indicated",
          "Only when trends in data need to be indicated"
        ],
        correctAnswers: ["Only when exact values need to be indicated"],
        explanation: "Graphs excel at communicating trends; tables are best suited when readers must inspect precise numerical values."
      },
      {
        id: "q34",
        questionText: "The length of a document",
        points: 1,
        type: "multiple",
        options: [
          "Indicates how much you know",
          "Indicates how little you know",
          "Does not indicate anything about your knowledge",
          "Does not indicate anything about the reader's knowledge"
        ],
        correctAnswers: [
          "Does not indicate anything about your knowledge",
          "Does not indicate anything about the reader's knowledge"
        ],
        explanation: "Document length is a function of scope and verbosity; it neither measures author depth nor reader competence."
      },
      {
        id: "q35",
        questionText: "The title of a paper should indicate the area of work as well as what is unique about the work.",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["True"],
        explanation: "A high-impact technical title precisely defines the domain and highlights the novel contribution."
      },
      {
        id: "q36",
        questionText: "In scientific documents sentences should be relatively short and to the point.",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["True"],
        explanation: "Concise, focused sentences reduce ambiguity and improve comprehension in technical documentation."
      },
      {
        id: "q37",
        questionText: "In an article, the image of a car engine must",
        points: 1,
        type: "multiple",
        options: [
          "Show the level of detail required for the discussion in the article",
          "Have a marker bar indicating scale",
          "Be in colour and not in black and white",
          "Be in black and white and not in colour"
        ],
        correctAnswers: [
          "Show the level of detail required for the discussion in the article",
          "Have a marker bar indicating scale"
        ],
        explanation: "Scientific images must show appropriate discussion detail and include scale/marker bars for dimensional reference."
      },
      {
        id: "q38",
        questionText: "Strategies one can use in the middle of a document include",
        points: 1,
        type: "multiple",
        options: [
          "Chronological strategy",
          "Spatial strategy",
          "Following a variable",
          "Suspense strategy"
        ],
        correctAnswers: [
          "Chronological strategy",
          "Spatial strategy",
          "Following a variable"
        ],
        explanation: "Standard document organization strategies include chronological flow, spatial progression, and tracking a specific variable."
      },
      {
        id: "q39",
        questionText: "While working with electricity only the voltage poses a danger to the users",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["False"],
        explanation: "Electric shock severity depends on current (amperage) flowing through tissue, frequency, path, and duration, not voltage alone."
      },
      {
        id: "q40",
        questionText: "“Pouring rain results in clogged drains, and slippery roads. These clogged drains spill further water on to the roads.” Use of the word ‘these’ in the previous sentence is ambiguous.",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["False"],
        explanation: "'These' clearly and unambiguously refers to the specific 'clogged drains' introduced in the immediately preceding sentence."
      }
    ]
  },
  {
    weekId: "week-5",
    weekNumber: 5,
    title: "Research Ethics, Creativity & Stress Management",
    badge: "Academic Integrity",
    questions: [
      {
        id: "q41",
        questionText: "According to Sternberg's theories of intelligence practical intelligence relates to-",
        points: 1,
        type: "multiple",
        options: [
          "How one relates to the environment around them",
          "How street smart they are",
          "How well they come up with new theories",
          "How well they solve new problems"
        ],
        correctAnswers: [
          "How one relates to the environment around them",
          "How street smart they are"
        ],
        explanation: "Sternberg's triarchic theory defines practical intelligence as contextual intelligence: relating effectively to everyday environment and practical 'street smarts'."
      },
      {
        id: "q42",
        questionText: "Few research scholars collaborated to work on some specific area. They generated some data and analysed the results. Some of them published the result independently since they were the first to type it up. Is it ethical to do so?",
        points: 1,
        type: "single",
        options: [
          "Yes, because they have collaborated and know each other",
          "No, all authors should know and agree with the publication",
          "Yes, if the collaborators are junior to you",
          "No, only if the authors are senior to you"
        ],
        correctAnswers: ["No, all authors should know and agree with the publication"],
        explanation: "Publishing without the knowledge and consent of co-contributors violates academic ethics and authorship guidelines."
      },
      {
        id: "q43",
        questionText: "Creativity is seen in",
        points: 1,
        type: "single",
        options: ["Drama", "Science fiction", "Engineering", "All of the above"],
        correctAnswers: ["All of the above"],
        explanation: "Creativity manifests across all domains including performance arts, literature, science fiction, and novel engineering solutions."
      },
      {
        id: "q44",
        questionText: "A good researcher is often well read in many areas",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["True"],
        explanation: "Broad multidisciplinary reading fosters lateral thinking, novel analogical problem-solving, and cross-pollination of ideas."
      },
      {
        id: "q45",
        questionText: "We can work to the best of our potential when we are —",
        points: 1,
        type: "single",
        options: ["Hypo stressed", "Eustressed", "Hyper stressed", "Distressed"],
        correctAnswers: ["Eustressed"],
        explanation: "Eustress is optimal, positive arousal that enhances focus, motivation, and cognitive performance without debilitating anxiety."
      },
      {
        id: "q46",
        questionText: "The measure of a successful researcher is that the work of the researcher should be",
        points: 1,
        type: "multiple",
        options: [
          "Recognized by peers at an international level",
          "Typically published in peer reviewed Journals",
          "Mentioned in the campus magazine of the college",
          "Must be discussed in the Department meeting of the researcher's department"
        ],
        correctAnswers: [
          "Recognized by peers at an international level",
          "Typically published in peer reviewed Journals"
        ],
        explanation: "Peer-reviewed journal publications and peer recognition validate genuine scientific contribution and rigorous scholarship."
      },
      {
        id: "q47",
        questionText: "Creative people are",
        points: 1,
        type: "multiple",
        options: [
          "More likely to follow societal restrictions",
          "Less likely to follow societal restrictions",
          "More likely to think within the limits of previous work in the area",
          "More likely to come up with a surprisingly new solution to a problem"
        ],
        correctAnswers: [
          "Less likely to follow societal restrictions",
          "More likely to come up with a surprisingly new solution to a problem"
        ],
        explanation: "Creative individuals exhibit cognitive flexibility, challenge conventional dogmas, and generate novel, unexpected solutions."
      },
      {
        id: "q48",
        questionText: "A PhD usually makes you",
        points: 1,
        type: "single",
        options: [
          "A specialist in one narrow area",
          "A person who conducts experiments fast",
          "A person who has a wide knowledge in a wide range of topics",
          "A person who makes excellent sketches"
        ],
        correctAnswers: ["A specialist in one narrow area"],
        explanation: "Doctoral research produces deep, authoritative domain specialization in a focused, narrow problem area."
      },
      {
        id: "q49",
        questionText: "To become a good researcher, one must usually",
        points: 1,
        type: "multiple",
        options: [
          "Have good communication skills",
          "Have mastery over specific techniques",
          "Have a line of investigation",
          "Be aware of recent advances in the field"
        ],
        correctAnswers: [
          "Have good communication skills",
          "Have mastery over specific techniques",
          "Have a line of investigation",
          "Be aware of recent advances in the field"
        ],
        explanation: "Successful researchers require clear communication, technical competence, a coherent research direction, and up-to-date domain awareness."
      },
      {
        id: "q50",
        questionText: "The followings can be attributed to a fully professional researcher-",
        points: 1,
        type: "multiple",
        options: [
          "They have some fundamental concepts that their peers (international) might be interested in",
          "They have command over their area",
          "They are aware of the situation where they can make significant contribution",
          "They work without focusing on literature in the area"
        ],
        correctAnswers: [
          "They have some fundamental concepts that their peers (international) might be interested in",
          "They have command over their area",
          "They are aware of the situation where they can make significant contribution"
        ],
        explanation: "Professional researchers possess subject mastery, clear strategic focus on gaps, and generate ideas valued by the global research community."
      }
    ]
  },
  {
    weekId: "week-6",
    weekNumber: 6,
    title: "Intellectual Property Rights & Patents",
    badge: "IP & Law",
    questions: [
      {
        id: "q51",
        questionText: "Which of the following falls in the category of intellectual property?",
        points: 1,
        type: "multiple",
        options: [
          "An original set of ideas or research results",
          "Ideas originating from real property",
          "Properties emanating from human creative labor",
          "All of the above"
        ],
        correctAnswers: [
          "An original set of ideas or research results",
          "Properties emanating from human creative labor"
        ],
        explanation: "Intellectual property encompasses intangible creations of human intellect, creative labor, and original research outcomes."
      },
      {
        id: "q52",
        questionText: "Violations of Intellectual Property Rights leads to",
        points: 1,
        type: "multiple",
        options: [
          "Infringement",
          "Casual penalties",
          "No big deal as we have license of fundamental rights to do whatever we want",
          "None of the above"
        ],
        correctAnswers: ["Infringement", "Casual penalties"],
        explanation: "Unauthorized use of protected IP constitutes infringement, carrying legal remedies and penalties."
      },
      {
        id: "q53",
        questionText: "In order to obtain legal protection, you don't have to register which of the following types of intellectual property rights?",
        points: 1,
        type: "single",
        options: ["Copyrights", "Patents", "Designs", "Geographical Indications"],
        correctAnswers: ["Copyrights"],
        explanation: "Copyright protection originates automatically upon creation and fixation in a tangible medium, without mandatory registration."
      },
      {
        id: "q54",
        questionText: "A person invents a new process to capture musical performance on tape, he/she will most likely apply for—",
        points: 1,
        type: "single",
        options: ["Copyrights", "Trade Marks", "Patents", "Trade Secret"],
        correctAnswers: ["Patents"],
        explanation: "A novel technical process or machine is eligible for patent protection."
      },
      {
        id: "q55",
        questionText: "Use of an unregistered trade mark of a competitor shall amount to a tort of—",
        points: 1,
        type: "single",
        options: ["Deceit", "Fraud", "Negligence", "Passing off"],
        correctAnswers: ["Passing off"],
        explanation: "Misrepresenting goods as that of another using an established unregistered trademark constitutes the tort of 'passing off'."
      },
      {
        id: "q56",
        questionText: "What does an IP right entitle a person?",
        points: 1,
        type: "single",
        options: [
          "Right to file a suit in case of an infringement",
          "Right of excludability",
          "Right of commercial exploitation",
          "All of the above"
        ],
        correctAnswers: ["All of the above"],
        explanation: "IP ownership confers commercial exploitation, excludability, and standing to sue for infringement."
      },
      {
        id: "q57",
        questionText: "The Reebok Delta symbol and Hyundai Logo are protected by—",
        points: 1,
        type: "single",
        options: ["Patents", "Trade Marks", "Trade dress", "Geographical Indications"],
        correctAnswers: ["Trade Marks"],
        explanation: "Commercial logos and brand symbols distinguishing company offerings are protected as Trade Marks."
      },
      {
        id: "q58",
        questionText: "Under the Patents Act, 1970, the person entitled to receive a patent on a new invention is—",
        points: 1,
        type: "single",
        options: [
          "The one who invented the invention first",
          "The one who commercialise the invention first",
          "The one who thought of the invention first",
          "The one who filed a patent application first"
        ],
        correctAnswers: ["The one who filed a patent application first"],
        explanation: "India follows the international 'first-to-file' priority system under the Patents Act, 1970."
      },
      {
        id: "q59",
        questionText: "What is the term of a Patent in India?",
        points: 1,
        type: "single",
        options: ["20 years", "25 years", "10 years", "15 years"],
        correctAnswers: ["20 years"],
        explanation: "In India, the statutory term of a granted patent is 20 years from the date of filing."
      },
      {
        id: "q60",
        questionText: "What is the full form of TRIPS?",
        points: 1,
        type: "single",
        options: [
          "Tariff Related Aspects of Intellectual Properties",
          "Trade Related Aspects of Intellectual Property Science",
          "The Registration of Intellectual Property",
          "Trade Related Aspects of Intellectual Property Rights"
        ],
        correctAnswers: ["Trade Related Aspects of Intellectual Property Rights"],
        explanation: "TRIPS stands for Trade Related Aspects of Intellectual Property Rights."
      }
    ]
  },
  {
    weekId: "week-7",
    weekNumber: 7,
    title: "Experimental Design & Data Analysis",
    badge: "Statistical Methods",
    questions: [
      {
        id: "q61",
        questionText: "In the true experimental research design:",
        points: 1,
        type: "single",
        options: [
          "No control on external variables",
          "Less control on external variables",
          "Control on external variables by randomization",
          "No use of randomization"
        ],
        correctAnswers: ["Control on external variables by randomization"],
        explanation: "True experimental design relies fundamentally on randomization to neutralize extraneous variables."
      },
      {
        id: "q62",
        questionText: "Which of the following is an incomplete experimental research design?",
        points: 1,
        type: "single",
        options: [
          "Before and after with control group design",
          "Factorial design",
          "One group before-after design",
          "Latin Square design"
        ],
        correctAnswers: ["One group before-after design"],
        explanation: "A single-group pretest-posttest design lacks a separate control group, making it an incomplete design."
      },
      {
        id: "q63",
        questionText: "Coefficient of Determination is said to be unity when -",
        points: 1,
        type: "multiple",
        options: [
          "Error Sum of Squares is zero",
          "Total Sum of Squares is zero",
          "Regression Sum of Squares is zero",
          "Regression Sum of Squares is same as Total Sum of Squares"
        ],
        correctAnswers: [
          "Error Sum of Squares is zero",
          "Regression Sum of Squares is same as Total Sum of Squares"
        ],
        explanation: "R² equals 1 when Error Sum of Squares is zero and Regression Sum of Squares equals Total Sum of Squares."
      },
      {
        id: "q64",
        questionText: "The probability density function describes the following -",
        points: 1,
        type: "single",
        options: [
          "Probability of a phenomenon occurring in macro scale",
          "Probability of a phenomenon occurring in micro scale",
          "Distribution of probabilities in the continuous random variable domain",
          "Distribution of probabilities in some particular set of undefined variables"
        ],
        correctAnswers: [
          "Distribution of probabilities in the continuous random variable domain"
        ],
        explanation: "A Probability Density Function (PDF) defines likelihood for a continuous random variable."
      },
      {
        id: "q65",
        questionText: "During Response Surface Methodology's Canonical Analysis involving two factors, maximum response is said to be achieved when the eigen values of the B matrix are",
        points: 1,
        type: "single",
        options: [
          "all positive",
          "all negative",
          "all zero",
          "such that one is positive and the other is negative"
        ],
        correctAnswers: ["all negative"],
        explanation: "Negative eigenvalues establish negative definiteness of matrix B, confirming a local maximum."
      },
      {
        id: "q66",
        questionText: "Experiments are conducted in laboratories to",
        points: 1,
        type: "single",
        options: [
          "Verify scientific predictions",
          "Obtain trends when theory is not known",
          "Find effect of different variables on the desired response",
          "All of the above"
        ],
        correctAnswers: ["All of the above"],
        explanation: "Laboratory experiments verify predictions, discover unknown trends, and study variable effects."
      },
      {
        id: "q67",
        questionText: "SPC and Design of Experiments are very closely interrelated.",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["True"],
        explanation: "Statistical Process Control and Design of Experiments are closely linked in quality engineering."
      },
      {
        id: "q68",
        questionText: "Which of these is not an application of experimental design in the field of Engineering design?",
        points: 1,
        type: "single",
        options: [
          "Evaluation and comparison of basic design configurations",
          "Evaluation of material alternatives",
          "Evaluation of key product design parameters that impact performance",
          "Evaluation of correct process to develop the product"
        ],
        correctAnswers: ["Evaluation of correct process to develop the product"],
        explanation: "Evaluating development processes belongs to manufacturing engineering rather than product engineering design."
      },
      {
        id: "q69",
        questionText: "The average estimated from a data collection is 50 cm. The quantity (quantities) which has the same units as the data is (are)",
        points: 1,
        type: "single",
        options: ["Standard deviation", "Median", "Mode", "All of the above"],
        correctAnswers: ["All of the above"],
        explanation: "Standard deviation, median, and mode all share the exact physical units of the observed variable (cm)."
      },
      {
        id: "q70",
        questionText: "Sample collected from an instrument giving binary data has the following values {1, -1, -1, 1, 1, -1} Mean of the above data set is",
        points: 1,
        type: "single",
        options: ["-1", "0", "1", "3"],
        correctAnswers: ["0"],
        explanation: "Sum = (1 - 1 - 1 + 1 + 1 - 1) = 0. Mean = 0 / 6 = 0."
      }
    ]
  },
  {
    weekId: "week-8",
    weekNumber: 8,
    title: "Research Objectives & Formulation",
    badge: "Proposal & Structure",
    questions: [
      {
        id: "q71",
        questionText: "In order to pursue the research, which of the following is priorly required?",
        points: 1,
        type: "single",
        options: [
          "Developing a research design",
          "Formulating a research question",
          "Deciding about the data analysis procedure",
          "Formulating a research hypothesis"
        ],
        correctAnswers: ["Formulating a research question"],
        explanation: "Formulating a clear research question is the fundamental first step required before designing experiments."
      },
      {
        id: "q72",
        questionText: "Which one among the following statements is false in the context of participatory research?",
        points: 1,
        type: "single",
        options: [
          "It recognizes knowledge as power",
          "It is a collective process of inquiry",
          "It emphasizes people as experts",
          "Its sole purpose is the production of knowledge"
        ],
        correctAnswers: ["Its sole purpose is the production of knowledge"],
        explanation: "Participatory action research aims for community empowerment and positive action, not solely abstract knowledge."
      },
      {
        id: "q73",
        questionText: "How to judge the depth of any research?",
        points: 1,
        type: "single",
        options: ["By research title", "By research duration", "By research objectives", "By total expenditure on research"],
        correctAnswers: ["By research objectives"],
        explanation: "The depth and rigor of research are judged by the clarity and ambition of its objectives."
      },
      {
        id: "q74",
        questionText: "What is the main aim of interdisciplinary research?",
        points: 1,
        type: "single",
        options: [
          "To over simplify the problem of research",
          "Integrating knowledge from multiple disciplines to solve a problem.",
          "To create a new trend in research methodology",
          "To reduce the emphasis on a single subject in the research domain"
        ],
        correctAnswers: ["Integrating knowledge from multiple disciplines to solve a problem."],
        explanation: "Interdisciplinary research integrates methodologies and insights from multiple fields to solve complex problems."
      },
      {
        id: "q75",
        questionText: "Electron microscopes can be used in reverse to write in extremely small areas",
        points: 1,
        type: "single",
        options: ["True", "False"],
        correctAnswers: ["True"],
        explanation: "Electron beam lithography uses electron optics in reverse to write nanoscale patterns."
      },
      {
        id: "q76",
        questionText: "What are the core elements of a dissertation?",
        points: 1,
        type: "single",
        options: [
          "Introduction; Data Collection; Data Analysis; Conclusions and Recommendations",
          "Executive Summary; Literature Review; Data Gathered; Conclusions; Bibliography",
          "Research Plan; Research Data; Analysis; References",
          "Introduction; Literature Review; Research Methodology; Results; Discussions and Conclusions"
        ],
        correctAnswers: [
          "Introduction; Literature Review; Research Methodology; Results; Discussions and Conclusions"
        ],
        explanation: "Standard dissertation architecture comprises Introduction, Literature Review, Methodology, Results, and Discussions & Conclusions."
      },
      {
        id: "q77",
        questionText: "How can we enhance the research objective?",
        points: 1,
        type: "single",
        options: ["By making it more valid", "By making it more reliable", "By making it more impartial", "All of the above"],
        correctAnswers: ["All of the above"],
        explanation: "Enhancing research objectives involves ensuring validity, reliability, and objective impartiality."
      },
      {
        id: "q78",
        questionText: "A common test in research demands much priority on",
        points: 1,
        type: "single",
        options: ["Reliability", "Useability", "Objectivity", "All of the above"],
        correctAnswers: ["All of the above"],
        explanation: "Experimental testing instruments require reliability, usability, and objectivity."
      },
      {
        id: "q79",
        questionText: "An appropriate source to find out descriptive information is",
        points: 1,
        type: "single",
        options: ["Bibliography", "Directory", "Encyclopedia", "Dictionary"],
        correctAnswers: ["Encyclopedia"],
        explanation: "Encyclopedias provide comprehensive descriptive overview summaries."
      },
      {
        id: "q80",
        questionText: "Mahabalipuram in south-east India, pre-eminently testimony to the __________ civilization",
        points: 1,
        type: "single",
        options: ["Pallavas", "Mauryas", "Guptas", "Cholas"],
        correctAnswers: ["Pallavas"],
        explanation: "Mahabalipuram features ancient monument architecture of the Pallava dynasty."
      }
    ]
  },
  {
    weekId: "week-9",
    weekNumber: 9,
    title: "Researcher Well-being & Lab Dynamics",
    badge: "Scholar Well-Being",
    questions: [
      {
        id: "q81",
        questionText: "Which of the following characteristics distinguish a research programme from a regular curriculum-oriented academic programme?",
        points: 1,
        type: "multiple",
        options: [
          "The research question may itself require extensive exploration before becoming well defined.",
          "Experimental outcomes may deviate from expectations and require modification of the research approach.",
          "The programme follows a highly predictable schedule with predefined learning outcomes for every stage.",
          "The researcher may repeatedly formulate new questions as insights emerge from previous work."
        ],
        correctAnswers: [
          "The research question may itself require extensive exploration before becoming well defined.",
          "Experimental outcomes may deviate from expectations and require modification of the research approach.",
          "The researcher may repeatedly formulate new questions as insights emerge from previous work."
        ],
        explanation: "Research involves open-ended exploration, unexpected results, and iterative formulation of new questions."
      },
      {
        id: "q82",
        questionText: "The lecture compares the research journey to a roller-coaster ride primarily because:",
        points: 1,
        type: "single",
        options: [
          "Research requires researchers to work continuously under high pressure.",
          "Research consists of predictable stages followed by unavoidable examinations.",
          "Research involves alternating periods of progress, uncertainty, setbacks, breakthroughs, and renewed progress.",
          "Research is primarily dependent on collaboration with a large number of researchers."
        ],
        correctAnswers: [
          "Research involves alternating periods of progress, uncertainty, setbacks, breakthroughs, and renewed progress."
        ],
        explanation: "The research journey alternates between periods of excitement, confusion, failure, breakthroughs, and renewed momentum."
      },
      {
        id: "q83",
        questionText: "According to the lecture, which factors can contribute to the overall research experience of a scholar in a laboratory?",
        points: 1,
        type: "multiple",
        options: [
          "Relationships with advisers and labmates",
          "Emotional experiences and friendships",
          "Availability and accessibility of research facilities",
          "Support received from friends and family"
        ],
        correctAnswers: [
          "Relationships with advisers and labmates",
          "Emotional experiences and friendships",
          "Availability and accessibility of research facilities",
          "Support received from friends and family"
        ],
        explanation: "Lab environment, mentorship, facilities, and personal relationships all shape the overall research experience."
      },
      {
        id: "q84",
        questionText: "Which practices are presented in the lecture as useful for maintaining a sustainable rhythm in research life?",
        points: 1,
        type: "multiple",
        options: [
          "Adequate sleep and physical activity",
          "Taking time for recreation and renewal",
          "Reflecting periodically on one's activities and decisions",
          "Working continuously for extremely long hours whenever a problem arises"
        ],
        correctAnswers: [
          "Adequate sleep and physical activity",
          "Taking time for recreation and renewal",
          "Reflecting periodically on one's activities and decisions"
        ],
        explanation: "Rest, physical activity, recreation, and reflective pauses maintain research stamina."
      },
      {
        id: "q85",
        questionText: "A researcher receives harsh feedback from an adviser and immediately feels angry and personally inadequate. Based on the lecture, what should be the most appropriate immediate response?",
        points: 1,
        type: "single",
        options: [
          "Respond immediately to the adviser to defend the research.",
          "Suppress the emotion completely and continue working without reflection.",
          "Pause, recognize the emotion, regulate it through techniques such as rhythmic breathing, and then respond with greater clarity.",
          "Discuss the adviser's behaviour with all labmates immediately."
        ],
        correctAnswers: [
          "Pause, recognize the emotion, regulate it through techniques such as rhythmic breathing, and then respond with greater clarity."
        ],
        explanation: "Pausing and regulating emotional responses allows for clear, constructive reflection before responding."
      },
      {
        id: "q86",
        questionText: "Which of the following strategies are specifically discussed in the lecture as ways of processing or reducing intense anger?",
        points: 1,
        type: "multiple",
        options: [
          "Practicing rhythmic breathing",
          "Temporarily stepping away from the situation",
          "Journaling what one is feeling",
          "Immediately confronting the person responsible for the trigger"
        ],
        correctAnswers: [
          "Practicing rhythmic breathing",
          "Temporarily stepping away from the situation",
          "Journaling what one is feeling"
        ],
        explanation: "Rhythmic breathing, stepping away, and expressive journaling help de-escalate anger."
      },
      {
        id: "q87",
        questionText: "A research scholar feels discouraged after a labmate's paper is accepted while their own paper remains unpublished. Which response best reflects the approach advocated in the lecture?",
        points: 1,
        type: "single",
        options: [
          "Compare the two researchers and conclude that the labmate is more capable.",
          "Suppress the feeling of comparison without examining its cause.",
          "Convert the comparison into curiosity by investigating what the labmate did differently and identifying possible improvements in one's own approach.",
          "Avoid interacting with the labmate until one's own paper is accepted."
        ],
        correctAnswers: [
          "Convert the comparison into curiosity by investigating what the labmate did differently and identifying possible improvements in one's own approach."
        ],
        explanation: "Converting comparison into curiosity helps scholars learn from others and refine their own methods."
      },
      {
        id: "q88",
        questionText: "According to the lecture, prolonged emotional distress or isolation can negatively affect which aspects of a researcher's life?",
        points: 1,
        type: "multiple",
        options: [
          "Research progress",
          "Only the researcher's publication record",
          "Physical health",
          "Friendships and social relationships"
        ],
        correctAnswers: [
          "Research progress",
          "Physical health",
          "Friendships and social relationships"
        ],
        explanation: "Prolonged distress hurts research productivity, physical health, and personal relationships."
      },
      {
        id: "q89",
        questionText: "A researcher becomes stuck on a difficult problem and begins working for very long hours while withdrawing from friends and labmates. According to the lecture, what is the primary concern with this response?",
        points: 1,
        type: "single",
        options: [
          "It demonstrates insufficient commitment to independent research.",
          "Emotional isolation may worsen the situation and negatively affect research progress as well as personal well-being.",
          "Long working hours always produce incorrect experimental results.",
          "Researchers should never attempt to solve difficult problems independently."
        ],
        correctAnswers: [
          "Emotional isolation may worsen the situation and negatively affect research progress as well as personal well-being."
        ],
        explanation: "Isolation and exhaustion amplify distress and undermine creative breakthrough thinking."
      },
      {
        id: "q90",
        questionText: "Which of the following constitute potential support systems for a research scholar according to the lecture?",
        points: 1,
        type: "multiple",
        options: [
          "Adviser or supervisor",
          "Labmates and friends",
          "Mentor",
          "Family or old friends"
        ],
        correctAnswers: [
          "Adviser or supervisor",
          "Labmates and friends",
          "Mentor",
          "Family or old friends"
        ],
        explanation: "A healthy support system includes supervisors, labmates, external mentors, and family."
      }
    ]
  },
  {
    weekId: "week-10",
    weekNumber: 10,
    title: "School vs Real-World Problems & Innovation",
    badge: "Problem Solving",
    questions: [
      {
        id: "q91",
        questionText: "Students in schools typically expect",
        points: 1,
        type: "multiple",
        options: [
          "Well defined questions",
          "Question paper patterns to be finalized in advance",
          "Clarity on the “portions” for an exam",
          "Questions outside the syllabus"
        ],
        correctAnswers: [
          "Well defined questions",
          "Question paper patterns to be finalized in advance",
          "Clarity on the “portions” for an exam"
        ],
        explanation: "School education emphasizes well-defined questions, fixed formats, and bounded syllabi."
      },
      {
        id: "q92",
        questionText: "From the perspective of a school student the question “How long will it take to go from Chennai to Kolkata” is",
        points: 1,
        type: "single",
        options: [
          "A “poorly” defined question",
          "Is a well defined question",
          "Is typically how a full question is framed in an exam",
          "Has a unique"
        ],
        correctAnswers: ["A “poorly” defined question"],
        explanation: "The question lacks mode of transport, speed, path, and parameters, making it poorly defined."
      },
      {
        id: "q93",
        questionText: "The format of exams in schools",
        points: 1,
        type: "multiple",
        options: [
          "Helps you understand fundamentals",
          "Teaches you to breakdown a problem to parts and solve them",
          "Prepares you for a professional setting",
          "Teaches you to handle unexpected questions"
        ],
        correctAnswers: [
          "Helps you understand fundamentals",
          "Teaches you to breakdown a problem to parts and solve them",
          "Prepares you for a professional setting"
        ],
        explanation: "School exams build fundamental knowledge and analytical decomposition skills."
      },
      {
        id: "q94",
        questionText: "A typical professional workplace requires you to",
        points: 1,
        type: "multiple",
        options: [
          "Handle open ended questions",
          "Solve “poorly” defined problems",
          "Focus on syllabus",
          "Work within a question paper pattern"
        ],
        correctAnswers: [
          "Handle open ended questions",
          "Solve “poorly” defined problems"
        ],
        explanation: "Workplace realities require framing and solving ambiguous, open-ended problems."
      },
      {
        id: "q95",
        questionText: "Learning in college is expected to",
        points: 1,
        type: "multiple",
        options: [
          "Prepare you for professional life",
          "Focus only on well-defined problems",
          "Teach you to handle open ended problems",
          "Follow the same approach used in school"
        ],
        correctAnswers: [
          "Prepare you for professional life",
          "Teach you to handle open ended problems"
        ],
        explanation: "Higher education trains students to handle open-ended challenges for professional careers."
      },
      {
        id: "q96",
        questionText: "Applying a known theory to one additional new situation is most likely",
        points: 1,
        type: "single",
        options: [
          "Breakthrough research",
          "Incremental research",
          "Transformational research",
          "Important contribution to research"
        ],
        correctAnswers: ["Incremental research"],
        explanation: "Applying an existing theory to one more case constitutes incremental research."
      },
      {
        id: "q97",
        questionText: "Use of a series of Experimental techniques to study the same phenomenon across different samples is typically an example of:",
        points: 1,
        type: "single",
        options: [
          "Systematic research",
          "Transformational research",
          "Incremental research",
          "Breakthrough research"
        ],
        correctAnswers: ["Systematic research"],
        explanation: "Methodically applying experimental techniques across samples is systematic research."
      },
      {
        id: "q98",
        questionText: "In the development of phones, which of the following can be considered transformational",
        points: 1,
        type: "single",
        options: [
          "First deployment of the landline",
          "First deployment of the cordless phone",
          "The improvement from cordless phone to mobile phone",
          "Making the first-generation mobile phones smaller and more colorful"
        ],
        correctAnswers: ["The improvement from cordless phone to mobile phone"],
        explanation: "Moving from tethered cordless phones to cellular mobile communication was transformational."
      },
      {
        id: "q99",
        questionText: "In the development of bicycles, which of the following can be considered transformational",
        points: 1,
        type: "single",
        options: [
          "Improvement from wooden seat to cushioned seat",
          "Making the seat more ergonomic",
          "Adding a carrier",
          "Adding gears to a bicycle"
        ],
        correctAnswers: ["Adding gears to a bicycle"],
        explanation: "Adding gears fundamentally transformed mechanical leverage, speed, and versatility."
      },
      {
        id: "q100",
        questionText: "In the development of airplanes, we can associate imagination with",
        points: 1,
        type: "single",
        options: [
          "Designing fixed wings even though birds have flapping wings",
          "Adding seats inside an airplane",
          "Creating a cargo version of the airplane",
          "Adding more engines to the airplane"
        ],
        correctAnswers: ["Designing fixed wings even though birds have flapping wings"],
        explanation: "Innovating rigid fixed wings instead of copying flapping wings demonstrated true imagination."
      }
    ]
  },
  {
    weekId: "week-11",
    weekNumber: 11,
    title: "Artificial Intelligence, LLMs & RAG",
    badge: "AI in Research",
    questions: [
      {
        id: "q101",
        questionText: "The lecture uses the example of Arthur Samuel's checkers program to illustrate an early form of learning by machines. Which of the following statements are correct?",
        points: 1,
        type: "multiple",
        options: [
          "The machine was explicitly programmed with every possible checkers strategy.",
          "The machine learned through experience by repeatedly playing the game.",
          "The example is associated with an early instance of reinforcement learning.",
          "The example demonstrates that AI-based learning is a phenomenon that began only with generative AI."
        ],
        correctAnswers: [
          "The machine learned through experience by repeatedly playing the game.",
          "The example is associated with an early instance of reinforcement learning."
        ],
        explanation: "Arthur Samuel's checkers program pioneered machine learning and reinforcement learning through self-play."
      },
      {
        id: "q102",
        questionText: "Which of the following statements correctly reflect the lecture's discussion of classical AI and generative AI?",
        points: 1,
        type: "multiple",
        options: [
          "Generative AI is the only appropriate approach for solving modern research problems.",
          "Classical AI methods can still provide effective solutions for domain-specific problems.",
          "Researchers should select an AI approach according to the problem rather than assuming that generative AI must always be used.",
          "Classical AI became irrelevant after the emergence of LLMs."
        ],
        correctAnswers: [
          "Classical AI methods can still provide effective solutions for domain-specific problems.",
          "Researchers should select an AI approach according to the problem rather than assuming that generative AI must always be used."
        ],
        explanation: "Classical AI remains valuable for domain tasks; researchers should match the tool to the specific problem."
      },
      {
        id: "q103",
        questionText: "Consider an LLM that predicts the next token from the context provided to it. Which of the following statements are correct?",
        points: 1,
        type: "multiple",
        options: [
          "The probability of a token can depend on the preceding context.",
          "A token with the highest probability must always be generated.",
          "Different contexts can result in different probability distributions for the next token.",
          "The model can repeatedly predict tokens to construct a longer response."
        ],
        correctAnswers: [
          "The probability of a token can depend on the preceding context.",
          "Different contexts can result in different probability distributions for the next token.",
          "The model can repeatedly predict tokens to construct a longer response."
        ],
        explanation: "LLMs compute context-dependent token probabilities and iteratively predict tokens to form complete texts."
      },
      {
        id: "q104",
        questionText: "Which of the following correctly distinguish token size, context size, and parameter count in an LLM?",
        points: 1,
        type: "multiple",
        options: [
          "Token size is related to the vocabulary of words or subwords that the model can generate.",
          "Context size refers to the amount of previous token information considered by the model.",
          "Parameter count refers to the number of tokens that can be stored in the prompt.",
          "Parameter count is related to how the learned probability distributions are represented in the model."
        ],
        correctAnswers: [
          "Token size is related to the vocabulary of words or subwords that the model can generate.",
          "Context size refers to the amount of previous token information considered by the model.",
          "Parameter count is related to how the learned probability distributions are represented in the model."
        ],
        explanation: "Token size corresponds to subword vocabulary, context size to the attention window, and parameter count to model weights."
      },
      {
        id: "q105",
        questionText: "Which statements correctly describe the role of vector representations in the LLM framework explained in the lecture?",
        points: 1,
        type: "multiple",
        options: [
          "A very large probability matrix can be represented through a comparatively smaller-dimensional vector space.",
          "Different contexts may be projected to nearby locations in the vector space.",
          "Such compression can contribute to variability and errors because information from different contexts may influence generation.",
          "Every possible context is retained as a completely independent point with no overlap."
        ],
        correctAnswers: [
          "A very large probability matrix can be represented through a comparatively smaller-dimensional vector space.",
          "Different contexts may be projected to nearby locations in the vector space.",
          "Such compression can contribute to variability and errors because information from different contexts may influence generation."
        ],
        explanation: "Vector embeddings compress large probability spaces and project related contexts close together, which can occasionally induce overlap errors."
      },
      {
        id: "q106",
        questionText: "Which of the following statements are consistent with the lecture's explanation of alignment?",
        points: 1,
        type: "multiple",
        options: [
          "Alignment can modify model behaviour so that generated probabilities better correspond to desired outcomes.",
          "Alignment may be directed towards objectives such as factuality, bias reduction or local context.",
          "Alignment guarantees that all outputs produced by an LLM are factually correct.",
          "Reinforcement learning from human preferences is associated with the alignment process."
        ],
        correctAnswers: [
          "Alignment can modify model behaviour so that generated probabilities better correspond to desired outcomes.",
          "Alignment may be directed towards objectives such as factuality, bias reduction or local context.",
          "Reinforcement learning from human preferences is associated with the alignment process."
        ],
        explanation: "Alignment steers model probabilities using techniques like RLHF for factuality and safety, but cannot guarantee 100% factual perfection."
      },
      {
        id: "q107",
        questionText: "A researcher asks a small language model a question whose meaning is ambiguous. Relevant information is retrieved from an internal repository and added to the original question before generating the answer. Which statements correctly describe this approach?",
        points: 1,
        type: "multiple",
        options: [
          "The approach is consistent with Retrieval-Augmented Generation (RAG).",
          "The retrieved information provides additional context to the model.",
          "The approach necessarily requires retraining the entire language model.",
          "Additional context can make the model's response more focused."
        ],
        correctAnswers: [
          "The approach is consistent with Retrieval-Augmented Generation (RAG).",
          "The retrieved information provides additional context to the model.",
          "Additional context can make the model's response more focused."
        ],
        explanation: "Retrieval-Augmented Generation adds external context dynamically without requiring full model retraining."
      },
      {
        id: "q108",
        questionText: "The lecture uses the example of the 2011 ICC World Cup to explain the effect of retrieval-augmented generation. Which of the following correctly captures the idea?",
        points: 1,
        type: "multiple",
        options: [
          "Additional retrieved information can contextualize an otherwise ambiguous query.",
          "The original question can be effectively shifted toward a more appropriate contextual representation.",
          "RAG works primarily by increasing the number of parameters in the LLM.",
          "A richer context can increase the probability of producing the intended"
        ],
        correctAnswers: [
          "Additional retrieved information can contextualize an otherwise ambiguous query.",
          "The original question can be effectively shifted toward a more appropriate contextual representation.",
          "A richer context can increase the probability of producing the intended"
        ],
        explanation: "Retrieving grounded context disambiguates queries and shifts vector representations toward intended outputs."
      },
      {
        id: "q109",
        questionText: "Which of the following statements about hallucination are correct according to the lecture?",
        points: 1,
        type: "multiple",
        options: [
          "A model may produce a plausible answer even when the generated information does not match the ground truth.",
          "Hallucination can occur when the model has insufficiently represented information or context.",
          "Hallucination can be reduced through techniques such as providing larger context, but it cannot necessarily be eliminated completely.",
          "Hallucination means that the model has deliberately decided to provide false information."
        ],
        correctAnswers: [
          "A model may produce a plausible answer even when the generated information does not match the ground truth.",
          "Hallucination can occur when the model has insufficiently represented information or context.",
          "Hallucination can be reduced through techniques such as providing larger context, but it cannot necessarily be eliminated completely."
        ],
        explanation: "Hallucinations produce plausible but inaccurate outputs due to probabilistic prediction; models have no conscious intent."
      },
      {
        id: "q110",
        questionText: "A language model produces a misleading recommendation because a false or deliberately misleading article was present in information from which the model learned. Which statements are appropriate?",
        points: 1,
        type: "multiple",
        options: [
          "The problem is necessarily an example of hallucination.",
          "AI systems can potentially propagate misinformation present in their information sources.",
          "A response may be misleading even when it is not simply an invented fact by the model.",
          "Independent verification of important AI-generated information remains necessary."
        ],
        correctAnswers: [
          "AI systems can potentially propagate misinformation present in their information sources.",
          "A response may be misleading even when it is not simply an invented fact by the model.",
          "Independent verification of important AI-generated information remains necessary."
        ],
        explanation: "Misinformation in training sources propagates through models; human independent verification is essential."
      }
    ]
  },
  {
    weekId: "week-12",
    weekNumber: 12,
    title: "Falsifiability, Bloom's Taxonomy & Functional Fixedness",
    badge: "Higher-Order Thinking",
    questions: [
      {
        id: "q111",
        questionText: "Which of the following statements correctly distinguish course-based education from research-based education as discussed in the lecture?",
        points: 1,
        type: "multiple",
        options: [
          "Course-based education primarily deals with an existing body of knowledge, whereas PhD research is expected to create new knowledge.",
          "A PhD programme follows a common prescribed syllabus and curriculum in the same way as a course-based degree.",
          "Course-based education generally has a prescribed syllabus and curriculum, whereas research-based education does not simply follow a fixed syllabus.",
          "Knowledge acquired in course-based education and new knowledge generated through PhD research are evaluated in exactly the same way."
        ],
        correctAnswers: [
          "Course-based education primarily deals with an existing body of knowledge, whereas PhD research is expected to create new knowledge.",
          "Course-based education generally has a prescribed syllabus and curriculum, whereas research-based education does not simply follow a fixed syllabus."
        ],
        explanation: "Coursework conveys existing curricula, while research-based education creates new knowledge without fixed syllabi."
      },
      {
        id: "q112",
        questionText: "A research scholar is beginning a PhD and expects the research guide to provide a complete step-by-step procedure for the entire research programme. Which responses are consistent with the lecture?",
        points: 1,
        type: "multiple",
        options: [
          "The scholar should recognize that PhD research involves substantially self-directed work.",
          "The absence of a fixed syllabus means that the scholar does not need guidance from the research guide.",
          "The research guide can provide guidance and support when ambiguity or difficulty arises.",
          "The scholar is expected to develop the ability to decide how the research should progress."
        ],
        correctAnswers: [
          "The scholar should recognize that PhD research involves substantially self-directed work.",
          "The research guide can provide guidance and support when ambiguity or difficulty arises.",
          "The scholar is expected to develop the ability to decide how the research should progress."
        ],
        explanation: "PhD research is self-directed where scholars develop decision-making skills with supervisor support during hurdles."
      },
      {
        id: "q113",
        questionText: "A researcher proposes a hypothesis based on existing knowledge and experience. Which conditions, according to the lecture, are relevant to treating it as a scientific hypothesis?",
        points: 1,
        type: "multiple",
        options: [
          "It should be an educated prediction rather than a statement already established as true.",
          "It should allow a possibility of being disproved.",
          "It should be protected from contradictory observations by adding explanations that cannot be tested.",
          "Its truth must be established before experiments or data collection begin."
        ],
        correctAnswers: [
          "It should be an educated prediction rather than a statement already established as true.",
          "It should allow a possibility of being disproved."
        ],
        explanation: "A scientific hypothesis must be an educated prediction and must be falsifiable (capable of disproof)."
      },
      {
        id: "q114",
        questionText: "Consider the hypothesis: “All swans are white.” Based on the falsifiability example in the lecture, which statements are correct?",
        points: 1,
        type: "multiple",
        options: [
          "Finding a black swan would provide an observation capable of disproving the hypothesis.",
          "It is necessary to observe every swan in the world before the hypothesis can be scientifically examined.",
          "The possibility of disproving the hypothesis is central to the criterion discussed in the lecture.",
          "The criterion discussed emphasizes the possibility of disproof rather than establishing the hypothesis as permanently true."
        ],
        correctAnswers: [
          "Finding a black swan would provide an observation capable of disproving the hypothesis.",
          "The possibility of disproving the hypothesis is central to the criterion discussed in the lecture.",
          "The criterion discussed emphasizes the possibility of disproof rather than establishing the hypothesis as permanently true."
        ],
        explanation: "Karl Popper's black swan example highlights that testability relies on susceptibility to empirical disproof."
      },
      {
        id: "q115",
        questionText: "A student starts a PhD after being given a broad research topic. According to the lecture, which actions are appropriate before arriving at a testable hypothesis?",
        points: 1,
        type: "multiple",
        options: [
          "Begin by formulating relevant questions about the topic and considering why the topic is important.",
          "Start an unrestricted literature survey immediately and use it as the only route for identifying the research problem.",
          "Use literature exploration and observations to refine the initial questions through repeated cycles.",
          "Formulate the final testable hypothesis immediately from the broad topic without further exploration."
        ],
        correctAnswers: [
          "Begin by formulating relevant questions about the topic and considering why the topic is important.",
          "Use literature exploration and observations to refine the initial questions through repeated cycles."
        ],
        explanation: "Formulate core questions and use repeated cycles of literature survey to narrow broad topics into testable hypotheses."
      },
      {
        id: "q116",
        questionText: "In the obesity and eating-habit example, observations from the literature and study were used to identify an anomaly and develop a hypothesis. Which statements are supported by the lecture?",
        points: 1,
        type: "multiple",
        options: [
          "An anomaly can arise when observations do not match a commonly assumed explanation.",
          "The observed influence of factors such as the amount of food offered can motivate further investigation.",
          "The hypothesis was formulated directly from the broad topic without literature survey or observations.",
          "Identifying a missing link or contradiction can provide scope for further research and help generate a hypothesis."
        ],
        correctAnswers: [
          "An anomaly can arise when observations do not match a commonly assumed explanation.",
          "The observed influence of factors such as the amount of food offered can motivate further investigation.",
          "Identifying a missing link or contradiction can provide scope for further research and help generate a hypothesis."
        ],
        explanation: "Anomalies, contradictory findings, and unexpected influences motivate research hypotheses."
      },
      {
        id: "q117",
        questionText: "According to the Revised Bloom’s Taxonomy discussed in the lecture, which statements are correct?",
        points: 1,
        type: "multiple",
        options: [
          "Remember, Understand and Apply are described as lower-order thinking levels.",
          "Analyze, Evaluate and Create are described as higher-order thinking levels.",
          "Create is placed below Remember because generating a new idea generally requires less cognitive effort.",
          "The taxonomy states that every individual experiences exactly the same difficulty across all six levels."
        ],
        correctAnswers: [
          "Remember, Understand and Apply are described as lower-order thinking levels.",
          "Analyze, Evaluate and Create are described as higher-order thinking levels."
        ],
        explanation: "Bloom's taxonomy classifies Remember, Understand, Apply as LOTS; and Analyze, Evaluate, Create as HOTS."
      },
      {
        id: "q118",
        questionText: "A PhD scholar collects experimental data, examines unfamiliar patterns, considers alternative hypotheses, and develops a new research idea. Which Bloom’s levels are most directly represented by these activities?",
        points: 1,
        type: "multiple",
        options: [
          "Analyze",
          "Evaluate",
          "Remember",
          "Create"
        ],
        correctAnswers: [
          "Analyze",
          "Evaluate",
          "Create"
        ],
        explanation: "Pattern examination represents Analyze; weighing hypotheses represents Evaluate; developing new ideas represents Create."
      },
      {
        id: "q119",
        questionText: "Which statements correctly reflect the lecture’s discussion of the role of higher-order thinking in PhD research?",
        points: 1,
        type: "multiple",
        options: [
          "All six levels of thinking may be used during research problem solving.",
          "The lecture identifies analysis as an important starting level in PhD research because researchers collect and analyze data.",
          "The main intellectual focus of a PhD is memorizing information from the existing body of knowledge.",
          "Evaluation can involve considering alternate hypotheses and attempting to validate them."
        ],
        correctAnswers: [
          "All six levels of thinking may be used during research problem solving.",
          "The lecture identifies analysis as an important starting level in PhD research because researchers collect and analyze data.",
          "Evaluation can involve considering alternate hypotheses and attempting to validate them."
        ],
        explanation: "All six levels are applied, prioritizing Analysis and Evaluation over rote memorization."
      },
      {
        id: "q120",
        questionText: "Which statements are consistent with the lecture’s discussion of creativity and functional fixedness?",
        points: 1,
        type: "multiple",
        options: [
          "Creative thinking can be developed or improved through practice rather than being limited to an ability fixed at birth.",
          "Functional fixedness can cause a person to perceive an object only through its conventional purpose and can hinder lateral thinking.",
          "Complete knowledge of the existing body of knowledge guarantees the creation of something new.",
          "Functional fixedness helps researchers generate new approaches when facing unexpected or novel challenges."
        ],
        correctAnswers: [
          "Creative thinking can be developed or improved through practice rather than being limited to an ability fixed at birth.",
          "Functional fixedness can cause a person to perceive an object only through its conventional purpose and can hinder lateral thinking."
        ],
        explanation: "Creativity can be trained; functional fixedness is a bias that limits thinking to conventional uses, hindering innovation."
      }
    ]
  }
];
