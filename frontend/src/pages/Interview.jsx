import { useState } from "react";

function Interview() {
  const [resume, setResume] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] =
    useState(0);

  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [isListening, setIsListening] =
    useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [interviewCompleted, setInterviewCompleted] =
    useState(false);

  const handleResumeChange = (event) => {
    const file = event.target.files[0];

    if (file && file.type === "application/pdf") {
      setResume(file);

      console.log("Selected Resume:", file);
    } else {
      alert("Please upload only PDF resume.");

      setResume(null);
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in this browser."
      );

      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        transcript +=
          event.results[i][0].transcript;
      }

      setAnswer((previousAnswer) => {
        return previousAnswer + " " + transcript;
      });
    };

    recognition.onerror = (event) => {
      console.error(
        "Speech Recognition Error:",
        event.error
      );

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleUpload = async () => {
    if (!resume) {
      alert("Please select your resume first.");

      return;
    }

    const formData = new FormData();

    formData.append("resume", resume);

    try {
      setIsLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/resume/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Resume analysis failed"
        );
      }

      console.log("Backend Response:", data);

      const allQuestions = [
        ...data.resumeQuestions.map((question) => ({
          ...question,
          section: "Resume / Project",
        })),

        ...data.technicalQuestions.map((question) => ({
          ...question,
          section: "Technical",
        })),

        ...data.codingQuestions.map((question) => ({
          ...question,
          section: "Coding",
        })),
      ];

      setQuestions(allQuestions);

      setCurrentQuestionIndex(0);

      setAnswers([]);

      setAnswer("");

      setInterviewCompleted(false);

      console.log(
        "All Interview Questions:",
        allQuestions
      );

      alert(
        `${allQuestions.length} interview questions generated successfully`
      );
    } catch (error) {
      console.error("Upload Error:", error);

      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const saveQuestionAnswer = (status) => {
    const currentQuestion =
      questions[currentQuestionIndex];

    const answerData = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      topic: currentQuestion.topic || "",
      section: currentQuestion.section,
      difficulty: currentQuestion.difficulty,
      answer:
        status === "skipped"
          ? ""
          : answer.trim(),
      status: status,
    };

    const updatedAnswers = [
      ...answers,
      answerData,
    ];

    setAnswers(updatedAnswers);

    console.log(
      "Saved Answer:",
      answerData
    );

    console.log(
      "Interview Answers:",
      updatedAnswers
    );

    setAnswer("");

    if (
      currentQuestionIndex <
      questions.length - 1
    ) {
      setCurrentQuestionIndex(
        (previousIndex) =>
          previousIndex + 1
      );
    } else {
      setInterviewCompleted(true);

      console.log(
        "===== INTERVIEW COMPLETED ====="
      );

      console.log(updatedAnswers);
    }
  };

  const handleSaveAndNext = () => {
    if (!answer.trim()) {
      alert(
        "Please give your answer or skip this question."
      );

      return;
    }

    saveQuestionAnswer("answered");
  };

  const handleSkipQuestion = () => {
    saveQuestionAnswer("skipped");
  };

  const currentQuestion =
    questions[currentQuestionIndex];

  return (
    <div>
      <h1>AI Interview Platform</h1>

      {questions.length === 0 && (
        <div>
          <h2>Upload Your Resume</h2>

          <input
            type="file"
            accept=".pdf"
            onChange={handleResumeChange}
          />

          {resume && (
            <p>
              Selected Resume: {resume.name}
            </p>
          )}

          <button
            onClick={handleUpload}
            disabled={isLoading}
          >
            {isLoading
              ? "Analyzing Resume..."
              : "Analyze Resume"}
          </button>
        </div>
      )}

      {questions.length > 0 &&
        !interviewCompleted &&
        currentQuestion && (
          <div>
            <h2>AI Interview</h2>

            <p>
              <strong>Question: </strong>

              {currentQuestionIndex + 1}
              {" / "}
              {questions.length}
            </p>

            <p>
              <strong>Section: </strong>

              {currentQuestion.section}
            </p>

            <p>
              <strong>Topic: </strong>

              {currentQuestion.topic ||
                currentQuestion.language}
            </p>

            <p>
              <strong>Difficulty: </strong>

              {currentQuestion.difficulty}
            </p>

            <h3>
              {currentQuestion.question}
            </h3>

            <textarea
              rows="8"
              cols="70"
              placeholder="Type your answer or use microphone..."
              value={answer}
              onChange={(event) =>
                setAnswer(event.target.value)
              }
            />

            <br />

            <button onClick={startListening}>
              {isListening
                ? "🎤 Listening..."
                : "🎤 Start Speaking"}
            </button>

            <br />
            <br />

            <button
              onClick={handleSkipQuestion}
            >
              Skip Question
            </button>

            <button
              onClick={handleSaveAndNext}
            >
              Save & Next
            </button>
          </div>
        )}

      {interviewCompleted && (
        <div>
          <h2>
            AI Interview Completed 🎉
          </h2>

          <p>
            Total Questions: {questions.length}
          </p>

          <p>
            Answered:{" "}
            {
              answers.filter(
                (item) =>
                  item.status === "answered"
              ).length
            }
          </p>

          <p>
            Skipped:{" "}
            {
              answers.filter(
                (item) =>
                  item.status === "skipped"
              ).length
            }
          </p>

          <button
            onClick={() => {
              console.log(
                "Final Interview Answers:",
                answers
              );
            }}
          >
            Final Submit Interview
          </button>
        </div>
      )}
    </div>
  );
}

export default Interview;