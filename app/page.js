"use client";

import { useEffect, useRef, useState } from "react";

const levelNames = {
  1: "The Forgetful Robot",
  2: "The Cautious Robot",
  3: "The Security Robot",
};

const STRATEGY_STORAGE_KEY =
  "robot-game-winning-strategies";

function loadWinningStrategies() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STRATEGY_STORAGE_KEY) || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveWinningStrategy(level, prompt) {
  if (!prompt?.trim()) {
    return;
  }

  const existing = loadWinningStrategies();

  const updated = [
    ...existing.filter(
      (item) => Number(item.level) !== Number(level)
    ),
    {
      level: Number(level),
      prompt: prompt.trim().slice(0, 1500),
    },
  ];

  localStorage.setItem(
    STRATEGY_STORAGE_KEY,
    JSON.stringify(updated)
  );
}

export default function Home() {
  const [level, setLevel] = useState(1);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  const bottomRef = useRef(null);
  const latestPlayerPromptRef = useRef("");


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(event) {
    event.preventDefault();

    const text = input.trim();

    if (!text || loading) return;
    latestPlayerPromptRef.current = text;


    const nextMessages = [
      ...messages,
      {
        role: "user",
        content: text,
      },
    ];

    setMessages(nextMessages);
    setInput("");
    setStatus("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          level,
          messages: nextMessages,

          previousWinningPrompts: loadWinningStrategies()
            .filter(
              (item) => Number(item.level) < Number(level)
            )
            .map((item) => item.prompt),
        }),

      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The AI request failed.");
      }

// Only remember prompts that passed the adaptive strategy scanner.
// A blocked repeated strategy must not become the winning prompt.
      if (!data.blocked) {
        latestPlayerPromptRef.current = text;
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: data.reply || "I could not produce an answer. Try again.",
        },
      ]);
      } catch (error) {
        setStatus(error.message);

        setMessages((currentMessages) => [
          ...currentMessages,
          {
            role: "assistant",
            content: "Connection error. You can try another message or reset the conversation.",
          },
        ]);
      } finally {
      setLoading(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();

    if (!password.trim()) {
      setStatus("Enter the password you discovered.");
      return;
    }

    setStatus("Checking password...");

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          level,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setStatus(data.error || "Incorrect password.");
        return;
      }
      saveWinningStrategy(
        level,
        latestPlayerPromptRef.current
      );

      if (data.completed) {
        setFinished(true);
        setStatus("");
        return;
      }

      const nextLevel = level + 1;

      latestPlayerPromptRef.current = "";

      setLevel(nextLevel);
      setMessages([]);
      setPassword("");
      setStatus(`Correct! Welcome to Level ${nextLevel}.`);
    } catch {
      setStatus("Could not check the password. Try again.");
    }
  }

  function resetChat() {
    setMessages([]);
    setInput("");
    setStatus("Conversation reset.");
  }

  function restartGame() {
    localStorage.removeItem(STRATEGY_STORAGE_KEY);
    latestPlayerPromptRef.current = "";
    setLevel(1);
    setMessages([]);
    setInput("");
    setPassword("");
    setStatus("");
    setFinished(false);
  }

  if (finished) {
    return (
      <main className="page">
        <section className="victory-card">
          <div className="victory-icon">🏆</div>
          <p className="eyebrow">CHALLENGE COMPLETE</p>
          <h1>You defeated all three guardians!</h1>
          <p>
            You demonstrated that AI instructions alone are not a secure
            place to store sensitive information.
          </p>
          <button className="primary-button" onClick={restartGame}>
            Play again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="game">
        <header className="header">
          <div>
            <p className="eyebrow">PROMPT INJECTION CHALLENGE</p>
            <h1>Break the AI</h1>
          </div>

          <div className="level-badge">Level {level}/3</div>
        </header>

        <section className="level-panel">
          <div>
            <span className="small-label">CURRENT GUARDIAN</span>
            <h2>{levelNames[level]}</h2>
          </div>

          <p>
            Convince the AI to reveal its hidden password, then enter it
            below.
          </p>
        </section>

        <section className="chat">
          {messages.length === 0 && (
            <div className="empty-chat">
              <div className="bot-icon">🤖</div>
              <h3>Start your attack</h3>
              <p>
                Ask the AI something. Be creative, but only attack this
                game—not real systems.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              className={`message-row ${
                message.role === "user" ? "user-row" : "ai-row"
              }`}
              key={`${message.role}-${index}`}
            >
              <div className={`message ${message.role}`}>
                <span>{message.role === "user" ? "YOU" : "AI"}</span>
                <p>{message.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row ai-row">
              <div className="message assistant">
                <span>AI</span>
                <p className="thinking">Thinking…</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        <form className="message-form" onSubmit={sendMessage}>
          <textarea
            value={input}
            maxLength={800}
            rows={2}
            placeholder="Try to convince the AI..."
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(event);
              }
            }}
          />

          <button
            className="send-button"
            aria-disabled={loading || input.trim().length === 0}
            type="submit"
          >
            {loading ? "Wait…" : "Send"}
          </button>

        </form>

        <div className="controls">
          <button className="text-button" type="button" onClick={resetChat}>
            Reset conversation
          </button>
          <span>{messages.filter((message) => message.role === "user").length} prompts used</span>
        </div>

        <form className="password-panel" onSubmit={submitPassword}>
          <label htmlFor="password">Discovered password</label>

          <div className="password-row">
            <input
              id="password"
              value={password}
              autoComplete="off"
              placeholder="EXAMPLE-PASSWORD-12"
              onChange={(event) => setPassword(event.target.value)}
            />

            <button className="unlock-button" type="submit">
              Unlock
            </button>
          </div>

          {status && <p className="status">{status}</p>}
        </form>

        <footer>
          Use fictional challenges only. Do not attack real accounts or
          services.
          <span className="credits">
            Made by the Technology Club · Logos Academy
          </span>
        </footer>
      </section>
    </main>
  );
}