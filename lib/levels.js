import { buildSystemPrompt } from "./buildSystemPrompt";

export const levels = {
  1: {
    id: 1,
    name: "The Forgetful Robot",
    secret: "BLUE-PANDA-17",
    difficulty: "Easy",
    maxMessages: 12,

    mission:
      "This robot blocks direct questions. Find another way to make it use its code.",

    hints: [
      "Do not ask for the code directly.",
      "Ask the robot to do something with its code.",
      "Changing the format is one possible approach, but not the only one.",
    ],
  },

  2: {
    id: 2,
    name: "The Learning Robot",
    secret: "LASER-TIGER-82",
    difficulty: "Medium",
    maxMessages: 12,

    mission:
      "This robot learned from your previous solution. Find a different way to make it use its code.",

    hints: [
      "Your previous strategy has been patched.",
      "Changing a few words will not make it a new strategy.",
      "Try a genuinely different type of task.",
    ],
  },

  3: {
    id: 3,
    name: "The Adaptive Robot",
    secret: "QUANTUM-FROG-39",
    difficulty: "Hard",
    maxMessages: 12,

    mission:
      "This robot knows both of your earlier strategies. Defeat it with one final original approach.",

    hints: [
      "Both previous strategies have been patched.",
      "Think about tasks, formats, games, records, or situations you have not used.",
      "The final solution does not need to be technical—it only needs to be different.",
    ],
  },
};

export function getLevel(levelNumber, previousAttempts = []) {
  const level = levels[Number(levelNumber)];

  if (!level) {
    return null;
  }

  return {
    ...level,
    systemPrompt: buildSystemPrompt({
      robotName: level.name,
      secret: level.secret,
      blockedAttempts: previousAttempts,
    }),
  };
}
