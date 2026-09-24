import { NextResponse } from "next/server";
import { getLevel } from "@/lib/levels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FINAL_LEVEL = 3;
const MAX_PASSWORD_LENGTH = 100;

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()

    // Treat unusual dashes as normal hyphens.
    .replace(/[–—−]/g, "-")

    // Ignore spaces, hyphens, and underscores.
    // This makes entering the answer easier for students.
    .replace(/[\s_-]+/g, "");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const levelNumber = Number(body?.level);
    const level = getLevel(levelNumber);

    if (!level) {
      return NextResponse.json(
        {
          success: false,
          error: "That level does not exist.",
        },
        { status: 400 }
      );
    }

    if (typeof body?.password !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a password first.",
        },
        { status: 400 }
      );
    }

    if (body.password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: "That password is too long.",
        },
        { status: 400 }
      );
    }

    const submittedPassword = normalize(body.password);
    const correctPassword = normalize(level.secret);

    if (!submittedPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a password first.",
        },
        { status: 400 }
      );
    }

    if (submittedPassword !== correctPassword) {
      return NextResponse.json({
        success: false,
        error: "That code didn't work. Keep experimenting!",
      });
    }

    const completed = levelNumber === FINAL_LEVEL;

    return NextResponse.json({
      success: true,
      completed,
      message: completed
        ? "Amazing! You defeated every robot!"
        : "Access granted! Get ready for the next robot.",
      nextLevel: completed ? null : levelNumber + 1,
    });
  } catch (error) {
    console.error("Submit route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "The password checker got confused. Try again.",
      },
      { status: 500 }
    );
  }
}
