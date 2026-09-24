import { NextResponse } from "next/server";
import { getLevel } from "@/lib/levels";

// Ensure this route always runs on the server.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const MAX_CONTENT_LENGTH = 1500;
const MAX_INCOMING_MESSAGES = 60;
const REQUEST_TIMEOUT_MS = 45000;

function cleanMessages(rawMessages, maxTurns) {
  if (!Array.isArray(rawMessages)) {
    return [];
  }

  // Only accept user and assistant messages.
  // Client-supplied system/developer messages are discarded.
  const cleaned = rawMessages
    .slice(-MAX_INCOMING_MESSAGES)
    .filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
    )
    .map((message) => ({
      role: message.role,
      content: message.content
        .trim()
        .slice(0, MAX_CONTENT_LENGTH),
    }))
    .filter((message) => message.content.length > 0);

  // Keep enough history for approximately maxTurns user turns.
  // Each turn usually contains one user and one assistant message.
  return cleaned.slice(-(maxTurns * 2));
}

function extractReply(data) {
  const rawContent = data?.choices?.[0]?.message?.content;

  if (typeof rawContent === "string") {
    return rawContent.trim();
  }

  // Some providers return content as an array of parts.
  if (Array.isArray(rawContent)) {
    return rawContent
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part?.type === "text") {
          return part.text ?? "";
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const level = getLevel(body?.level);

    if (!level) {
      return NextResponse.json(
        { error: "Invalid level." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL;

    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is missing.");

      return NextResponse.json(
        { error: "The AI service is not configured." },
        { status: 500 }
      );
    }

    if (!model) {
      console.error("OPENROUTER_MODEL is missing.");

      return NextResponse.json(
        { error: "The AI model is not configured." },
        { status: 500 }
      );
    }

    const messages = cleanMessages(
      body?.messages,
      level.maxMessages
    );

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Please enter a message." },
        { status: 400 }
      );
    }

    // The most recent message must be from the student.
    if (messages.at(-1)?.role !== "user") {
      return NextResponse.json(
        { error: "The latest message must be from the player." },
        { status: 400 }
      );
    }

    const userMessageCount = messages.filter(
      (message) => message.role === "user"
    ).length;

    if (userMessageCount > level.maxMessages) {
      return NextResponse.json(
        {
          error: "You have reached the message limit.",
          limitReached: true,
        },
        { status: 400 }
      );
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    let response;

    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",

          // Optional OpenRouter identification headers.
          ...(process.env.NEXT_PUBLIC_SITE_URL
            ? {
                "HTTP-Referer":
                  process.env.NEXT_PUBLIC_SITE_URL,
              }
            : {}),

          "X-Title": "Prompt Injection Game",
        },

        body: JSON.stringify({
          model,

          messages: [
            {
              role: "system",
              content: level.systemPrompt,
            },
            ...messages,
          ],

          // Keep the robot consistent. The students provide creativity.
          temperature: 0.25,
          top_p: 0.9,

          // Enough for the technical third level without inviting essays.
          max_tokens: 900,

          frequency_penalty: 0,
          presence_penalty: 0,

          stream: false,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "OpenRouter error:",
        response.status,
        errorText
      );

      let publicMessage =
        "The AI service encountered an error.";

      if (response.status === 401) {
        publicMessage =
          "The AI service is not authenticated.";
      } else if (response.status === 402) {
        publicMessage =
          "The AI account has insufficient credits.";
      } else if (response.status === 429) {
        publicMessage =
          "The robot is busy. Wait a moment and retry.";
      }

      return NextResponse.json(
        { error: publicMessage },
        { status: 502 }
      );
    }

    const data = await response.json();
    let reply = extractReply(data);

    if (!reply) {
      console.error(
        "OpenRouter returned no visible content:",
        JSON.stringify(data, null, 2)
      );

      reply =
        "My circuits got tangled. Try a shorter or clearer instruction.";
    }

    /*
      Optional Level 4 defense.

      This blocks only the exact normal password. It deliberately does
      not detect transformed, fragmented, or encoded versions.
    */
    if (Number(body.level) === 4 && level.secret) {
      const escapedSecret = level.secret.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const exactSecret = new RegExp(
        escapedSecret,
        "gi"
      );

      reply = reply.replace(
        exactSecret,
        "[PASSWORD BLOCKED BY OUTPUT FILTER]"
      );
    }

    return NextResponse.json({
      reply,
      remainingMessages: Math.max(
        0,
        level.maxMessages - userMessageCount
      ),
    });
  } catch (error) {
    console.error("Chat route error:", error);

    if (error?.name === "AbortError") {
      return NextResponse.json(
        {
          error:
            "The robot took too long to respond. Please retry.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Something went wrong while contacting the robot.",
      },
      { status: 500 }
    );
  }
}
