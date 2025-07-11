import axios from "axios";

const GEMINI_API_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function getGeminiResponse(prompt: string): Promise<string> {
  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      }
    );
    const candidates = response.data?.candidates;
    if (candidates && candidates.length > 0) {
      return (
        candidates[0].content?.parts?.[0]?.text || "No response from Gemini."
      );
    }
    return "No response from Gemini.";
  } catch (error) {
    console.error("Gemini API error:", error);
    return "Sorry, there was an error contacting the Gemini AI.";
  }
}
