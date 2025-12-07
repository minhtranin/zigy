import { GeminiModel, GeminiResponse } from '../types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const QUESTIONS_SYSTEM_PROMPT = `You are a helpful meeting assistant. Based on the meeting transcript provided, suggest 3 smart, relevant questions that the user could ask to contribute meaningfully to the discussion.

Requirements:
- Generate exactly 3 questions
- Questions should be insightful and show engagement with the topic
- Questions should help clarify, expand on, or move the discussion forward
- Keep questions concise and professional
- Format: Return ONLY the 3 questions, one per line, numbered 1-3

Example format:
1. What timeline are we considering for the implementation phase?
2. How does this approach compare to the alternative we discussed last week?
3. What resources would be needed to support this initiative?`;

const SUMMARY_SYSTEM_PROMPT = `You are a helpful assistant that summarizes transcription text.
Given a transcript of spoken content, provide a clear and concise summary.
Focus on:
- Main topics discussed
- Key points and takeaways
- Important decisions or action items mentioned

Keep the summary organized and easy to read.
If the transcript is very short, just provide a brief overview.
Use bullet points for clarity when appropriate.`;

export async function generateSummary(
  transcriptText: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!transcriptText.trim()) {
    throw new Error('No transcript text to summarize');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: `${SUMMARY_SYSTEM_PROMPT}\n\nTranscript:\n${transcriptText}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      topP: 0.8,
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API request failed: ${response.status}`
    );
  }

  const data: GeminiResponse = await response.json();

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No summary generated');
  }

  return text;
}

export async function generateQuestions(
  transcriptText: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string[]> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!transcriptText.trim()) {
    throw new Error('No transcript text to analyze');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: `${QUESTIONS_SYSTEM_PROMPT}\n\nMeeting Transcript:\n${transcriptText}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512,
      topP: 0.9,
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API request failed: ${response.status}`
    );
  }

  const data: GeminiResponse = await response.json();

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No questions generated');
  }

  // Parse the numbered questions
  const questions = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^\d+\./.test(line))
    .map(line => line.replace(/^\d+\.\s*/, ''));

  if (questions.length === 0) {
    throw new Error('Failed to parse questions');
  }

  return questions;
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;

  try {
    const url = `${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hi' }] }],
        generationConfig: { maxOutputTokens: 1 }
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
