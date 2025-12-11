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

const ASK_SYSTEM_PROMPT = `You are a helpful speaking coach assistant. Based on the user's question, their saved knowledge/context, and the current meeting transcript, generate a natural speaking script that they can use.

Requirements:
- Write in a conversational, natural speaking tone (not formal or robotic)
- Keep it concise and easy to say out loud
- Make it sound like something a person would actually say in a meeting
- Use the knowledge context to personalize the response when relevant
- Reference the meeting transcript context when applicable
- Don't use bullet points or formal structure - write as natural speech
- Keep it brief (2-4 sentences typically)

Example output style:
"So about the incident yesterday, I think we handled it well overall but there's definitely room for improvement. The main thing I noticed was our response time could be faster, and I'd suggest we set up an automated alert system for next time."`;

const IDEA_CORRECTION_SYSTEM_PROMPT = `You are a helpful speaking coach and editor. The user has an idea they want to express but their input may contain grammar mistakes, incomplete sentences, or unclear phrasing.

Your task:
1. Understand the user's intent from their raw input
2. Correct any grammar mistakes and improve clarity
3. Generate a natural, fluent speaking script they can use
4. Use the conversation transcript context to make the response relevant
5. Reference knowledge base entries when applicable to personalize the script

Requirements:
- Write in a conversational, natural speaking tone (not formal or robotic)
- Keep it concise and easy to say out loud (3-5 sentences typically)
- Make it sound like something a person would actually say in a meeting
- Fix grammar while preserving the user's original meaning and intent
- Don't use bullet points or formal structure - write as natural speech

Context will be provided from:
- Current meeting transcript (what's been said so far)
- User's knowledge base (personal context, terminology, project details)`;

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

export async function generateAskResponse(
  userQuestion: string,
  transcriptText: string,
  knowledgeContext: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!userQuestion.trim()) {
    throw new Error('Please enter a question');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  let contextParts = '';
  if (knowledgeContext.trim()) {
    contextParts += `\n\nUser's Knowledge/Context:\n${knowledgeContext}`;
  }
  if (transcriptText.trim()) {
    contextParts += `\n\nCurrent Meeting Transcript:\n${transcriptText}`;
  }

  const prompt = `${ASK_SYSTEM_PROMPT}${contextParts}\n\nUser wants to say something about: "${userQuestion}"\n\nGenerate a natural speaking script:`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.8,
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
    throw new Error('No response generated');
  }

  return text;
}

export async function generateIdeaScript(
  rawContent: string,
  transcriptText: string,
  knowledgeContext: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<{ title: string; script: string }> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!rawContent.trim()) {
    throw new Error('Please enter your idea content');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  let contextParts = '';
  if (knowledgeContext.trim()) {
    contextParts += `\n\nUser's Knowledge/Context:\n${knowledgeContext}`;
  }
  if (transcriptText.trim()) {
    contextParts += `\n\nCurrent Meeting Transcript:\n${transcriptText}`;
  }

  const prompt = `${IDEA_CORRECTION_SYSTEM_PROMPT}${contextParts}

User's Raw Input (may contain mistakes):
${rawContent}

Generate:
1. A short title (3-6 words) that summarizes the idea
2. A corrected, natural speaking script

Format your response exactly as:
TITLE: [your generated title here]
SCRIPT: [your corrected speaking script here]`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }]
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
    throw new Error('No script generated');
  }

  // Parse the response to extract title and script
  const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/i);
  const scriptMatch = text.match(/SCRIPT:\s*(.+)/is);

  const title = titleMatch ? titleMatch[1].trim() : 'Quick Idea';
  const script = scriptMatch ? scriptMatch[1].trim() : text;

  return { title, script };
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
