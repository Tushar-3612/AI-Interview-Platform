import { useState } from "react";

function App() {
  const [resume, setResume] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [isListening, setIsListening] = useState(false);

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

      setAnswer(transcript);
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
      const handleSubmitAnswer = async () => {
  if (!answer.trim()) {
    alert("Please give your answer first.");
    return;
  }

  try {
    const response = await fetch(
      "http://localhost:5000/api/interview/evaluate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.question,
          answer: answer,
        }),
      }
    );

    const data = await response.json();

    console.log("Evaluation Response:", data);
  } catch (error) {
    console.error("Evaluation Error:", error);
  }
};
      return;
    }

    const formData = new FormData();

    formData.append("resume", resume);

    try {
      const response = await fetch(
        "http://localhost:5000/api/resume/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      console.log("Backend Response:", data);

      setQuestion(data.firstQuestion);

      alert(data.message);
    } catch (error) {
      console.error("Upload Error:", error);
    }
  };

  return (
    <div>
      <h1>AI Interview Platform</h1>

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

      <button onClick={handleUpload}>
        Analyze Resume
      </button>

      {question && (
        <div>
          <h2>AI Interview Question</h2>

          <p>
            <strong>Topic: </strong>
            {question.topic}
          </p>

          <p>
            <strong>Difficulty: </strong>
            {question.difficulty}
          </p>

          <h3>{question.question}</h3>

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

<button onClick={handleSubmitAnswer}>
  Submit Answer
</button>
        </div>
      )}
    </div>
  );
}

export default App;