import "server-only";
import { GoogleGenAI } from "@google/genai";
import { requireServerEnv } from "@/lib/env/server";

let client: GoogleGenAI | undefined;

export function getGeminiClient() {
  client ??= new GoogleGenAI({ apiKey: requireServerEnv("GEMINI_API_KEY") });
  return client;
}

export const GEMINI_MODEL = "gemini-3.8-flash" as const;
