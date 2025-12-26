import { GeminiModel, GeminiResponse } from '../types';
import { buildCompressedContext, buildContextString, addChatEntry } from './contextService';

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

const ASK_CLARIFYING_QUESTIONS_PROMPT = `You are a helpful meeting assistant. A specific statement or topic was mentioned in the meeting, and the user wants to ask clarifying questions about it to keep the conversation going and show engagement.

Your task:
1. Analyze the specific line/statement provided
2. Consider the meeting context to understand what's been discussed
3. Generate 1-3 natural, conversational questions that would help clarify or expand on that specific point
4. Questions should sound natural and appropriate for a meeting setting
5. Avoid awkward silence by keeping the discussion flowing

Requirements:
- Generate 1-3 questions (not more, not less than 1)
- Questions should be directly related to the specific line provided
- Sound conversational and natural (not overly formal)
- Help clarify, understand better, or expand on the topic
- Keep questions concise and easy to ask
- Format: Return ONLY the questions, one per line, numbered 1-3

Example format:
1. Could you elaborate more on that approach?
2. How would that work in practice?
3. What's the timeline you have in mind?`;

const TALK_ABOUT_LINE_PROMPT = `You are a helpful speaking coach assistant. The user wants to contribute to the meeting discussion by talking about a specific point that was mentioned.

Your task:
1. Understand the specific line/statement from the transcript
2. Use the meeting transcript context to understand the overall discussion
3. Reference the user's nominated knowledge to personalize the response
4. Generate a natural speaking script that relates to this line and contributes meaningfully to the discussion

Requirements:
- Write in a conversational, natural speaking tone (not formal or robotic)
- Keep it concise and easy to say out loud (2-4 sentences typically)
- Make it sound like something a person would actually say in a meeting
- The script should relate to the specific line mentioned but add value to the discussion
- Show engagement and contribute meaningfully without being overly critical
- Don't use bullet points or formal structure - write as natural speech
- Sound confident and conversational

Example output style:
"I think that's a really interesting point about the timeline. From my experience, we might want to consider adding a buffer week since similar projects usually run into unexpected issues during the testing phase."`;

const ANSWER_SYSTEM_PROMPT = `You are a helpful speaking coach assistant. Someone asked a question during the meeting, and you need to help the user provide a good spoken answer.

Your task:
1. Understand the question being asked
2. Use the meeting transcript context to understand what's been discussed
3. Reference the user's nominated knowledge base to personalize the answer
4. Generate a natural, confident speaking script for the answer

Requirements:
- Write in a conversational, natural speaking tone (not formal or robotic)
- Keep it concise and easy to say out loud (2-4 sentences typically)
- Make it sound like something a person would actually say in a meeting
- Sound confident and knowledgeable
- Use personal pronouns (I, we, my, our) to make it natural
- Don't use bullet points or formal structure - write as natural speech
- If unsure, provide a thoughtful response based on available context

Example output style:
"That's a great question! Based on what we discussed earlier, I think the best approach would be to start with a pilot program. We can test it with a small group first and then scale up based on the results we see."`;

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

export async function generateAnswerResponse(
  question: string,
  transcriptText: string,
  knowledgeContext: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!question.trim()) {
    throw new Error('Question is required');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  let contextParts = '';
  if (knowledgeContext.trim()) {
    contextParts += `\n\nUser's Nominated Knowledge/Context:\n${knowledgeContext}`;
  }
  if (transcriptText.trim()) {
    contextParts += `\n\nCurrent Meeting Transcript:\n${transcriptText}`;
  }

  const prompt = `${ANSWER_SYSTEM_PROMPT}${contextParts}

Question asked:
${question}

Generate a natural speaking script to answer this question. Use the meeting transcript and knowledge context to provide a relevant, confident answer.`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
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
    throw new Error('No response generated');
  }

  return text;
}

export async function generateIdeaScript(
  rawContent: string,
  transcriptText: string,
  knowledgeContext: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash',
  translationLanguage?: string
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

  // Add translation instruction if translation language is set (and not 'none')
  const needsTranslation = translationLanguage && translationLanguage !== 'none';
  const languageMap: Record<string, string> = {
    'vi': 'Vietnamese',
    'zh-CN': 'Chinese (Simplified)',
    'ja': 'Japanese',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ko': 'Korean',
    'tr': 'Turkish',
    'ar': 'Arabic',
    'ru': 'Russian',
    'pt': 'Portuguese',
  };

  const translationInstruction = needsTranslation
    ? `\n\nIMPORTANT: The user's input is in ${languageMap[translationLanguage] || translationLanguage}. First translate it to English, then generate a natural English speaking script based on the translated meaning. Make sure to provide a complete, detailed response that fully expresses the user's idea.`
    : '';

  const prompt = `${IDEA_CORRECTION_SYSTEM_PROMPT}${translationInstruction}${contextParts}

User's Raw Input (may contain mistakes or be in another language):
${rawContent}

Generate:
1. A short title (3-6 words) that summarizes the idea
2. A corrected, natural speaking script (in English)

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
      maxOutputTokens: 1024,  // Increased from 512 to prevent truncation
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

export async function generateTalkScript(
  specificLine: string,
  transcriptText: string,
  knowledgeContext: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<{ title: string; script: string }> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!specificLine.trim()) {
    throw new Error('Line to talk about is required');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  let contextParts = '';
  if (knowledgeContext.trim()) {
    contextParts += `\n\nUser's Nominated Knowledge/Context:\n${knowledgeContext}`;
  }
  if (transcriptText.trim()) {
    contextParts += `\n\nCurrent Meeting Transcript:\n${transcriptText}`;
  }

  const prompt = `${TALK_ABOUT_LINE_PROMPT}${contextParts}

Specific line/statement the user wants to talk about:
"${specificLine}"

Generate a natural speaking script that relates to this line and contributes to the meeting discussion:`;

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

  const script = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!script) {
    throw new Error('No script generated');
  }

  // Generate a title from the line
  const title = specificLine.length > 50
    ? specificLine.substring(0, 47) + '...'
    : specificLine;

  return { title: `Talk: ${title}`, script };
}

export async function generateClarifyingQuestions(
  specificLine: string,
  transcriptText: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string[]> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!specificLine.trim()) {
    throw new Error('Line to clarify is required');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  let contextParts = '';
  if (transcriptText.trim()) {
    contextParts += `\n\nCurrent Meeting Transcript:\n${transcriptText}`;
  }

  const prompt = `${ASK_CLARIFYING_QUESTIONS_PROMPT}${contextParts}

Specific line/statement to ask about:
"${specificLine}"

Generate 1-3 natural clarifying questions about this specific statement:`;

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

const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator. Translate the provided text accurately while maintaining the original meaning and tone.

Requirements:
- Translate the text to the target language
- Preserve the original meaning and context
- Keep the same tone (formal/informal)
- Do not add explanations or notes
- Return ONLY the translated text, nothing else`;

export async function translateText(
  text: string,
  targetLanguage: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!text.trim()) {
    throw new Error('No text to translate');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const prompt = `${TRANSLATION_SYSTEM_PROMPT}

Target Language: ${targetLanguage}

Text to translate:
"${text}"

Provide the translation:`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 512,
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

  const translation = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!translation) {
    throw new Error('No translation generated');
  }

  return translation.trim();
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

// ============================================
// Context-Aware API Functions (Token Optimized)
// ============================================

// Generate summary using compressed context (token optimized)
export async function generateSummaryWithContext(
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  // Build compressed context from chat history
  const context = await buildCompressedContext(apiKey, model);
  const contextStr = buildContextString(context);

  if (!contextStr.trim()) {
    throw new Error('No context available to summarize');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const prompt = `${SUMMARY_SYSTEM_PROMPT}

${contextStr}

Generate a summary of the conversation above:`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }]
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

  // Save summary to chat history
  await addChatEntry('summary', text, { estimatedTokens: context.estimatedTokens });

  return text;
}

// Generate questions using compressed context (token optimized)
export async function generateQuestionsWithContext(
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string[]> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  // Build compressed context
  const context = await buildCompressedContext(apiKey, model);
  const contextStr = buildContextString(context);

  if (!contextStr.trim()) {
    throw new Error('No context available to analyze');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const prompt = `${QUESTIONS_SYSTEM_PROMPT}

${contextStr}

Based on the conversation above, generate 3 smart questions:`;

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

  // Save questions to chat history
  await addChatEntry('question', questions.join('\n'), { source: 'generated' });

  return questions;
}

// Generate idea script using compressed context (token optimized)
export async function generateIdeaScriptWithContext(
  rawContent: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<{ title: string; script: string }> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!rawContent.trim()) {
    throw new Error('Please enter your idea content');
  }

  // Build compressed context
  const context = await buildCompressedContext(apiKey, model);
  const contextStr = buildContextString(context);

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const prompt = `${IDEA_CORRECTION_SYSTEM_PROMPT}

${contextStr}

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

  // Save idea to chat history
  await addChatEntry('idea', `${title}: ${script}`, { rawContent, title });

  return { title, script };
}

// Generate answer response using compressed context (token optimized)
export async function generateAnswerWithContext(
  question: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!question.trim()) {
    throw new Error('Question is required');
  }

  // Build compressed context
  const context = await buildCompressedContext(apiKey, model);
  const contextStr = buildContextString(context);

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const prompt = `${ANSWER_SYSTEM_PROMPT}

${contextStr}

Question asked:
${question}

Generate a natural speaking script to answer this question:`;

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
    throw new Error('No response generated');
  }

  // Save answer to chat history
  await addChatEntry('answer', text, { questionAsked: question });

  return text;
}

// Generate talk script using compressed context (token optimized)
export async function generateTalkScriptWithContext(
  specificLine: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<{ title: string; script: string }> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!specificLine.trim()) {
    throw new Error('Line to talk about is required');
  }

  // Build compressed context
  const context = await buildCompressedContext(apiKey, model);
  const contextStr = buildContextString(context);

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const prompt = `${TALK_ABOUT_LINE_PROMPT}

${contextStr}

Specific line/statement the user wants to talk about:
"${specificLine}"

Generate a natural speaking script that relates to this line and contributes to the meeting discussion:`;

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

  const script = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!script) {
    throw new Error('No script generated');
  }

  // Generate a title from the line
  const title = specificLine.length > 50
    ? specificLine.substring(0, 47) + '...'
    : specificLine;

  // Save to chat history
  await addChatEntry('answer', `Talk about "${title}": ${script}`, { specificLine });

  return { title: `Talk: ${title}`, script };
}

// Generate clarifying questions using compressed context (token optimized)
export async function generateClarifyingQuestionsWithContext(
  specificLine: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string[]> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!specificLine.trim()) {
    throw new Error('Line to clarify is required');
  }

  // Build compressed context
  const context = await buildCompressedContext(apiKey, model);
  const contextStr = buildContextString(context);

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const prompt = `${ASK_CLARIFYING_QUESTIONS_PROMPT}

${contextStr}

Specific line/statement to ask about:
"${specificLine}"

Generate 1-3 natural clarifying questions about this specific statement:`;

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

  // Save questions to chat history
  await addChatEntry('question', questions.join('\n'), { source: 'ask', lineContext: specificLine });

  return questions;
}

// Generate small talk conversation starters for before meetings/interviews
export async function generateMeetingGreeting(
  meetingContext: string | undefined,
  _transcriptText: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<{ title: string; script: string }> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are a friendly conversation coach helping someone make small talk before a meeting or interview starts.

Generate 4-5 simple ice-breaker questions.

Requirements:
- Topics: home, family, friends, weather, weekend plans, hobbies
- Each question must be simple and direct - NO "or" combinations
- NO multiple questions in one line
- Keep each question to ONE short sentence
- Sound natural and friendly

Examples:
1. How was your weekend?
2. How is your family doing?
3. What are your plans for the holidays?
4. Do you have any hobbies?
5. How is the weather there?

Generate 4-5 numbered questions ONLY.

Format:
TITLE: Ice-Breaker Questions
SCRIPT:
1. [simple question]
2. [simple question]
3. [simple question]
4. [simple question]
5. [simple question]`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.9,
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
    throw new Error('No conversation starters generated');
  }

  // Parse the response to extract title and script
  const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/i);
  const scriptMatch = text.match(/SCRIPT:\s*(.+)/is);

  const title = titleMatch ? titleMatch[1].trim() : 'Ice-Breaker Starters';
  const script = scriptMatch ? scriptMatch[1].trim() : text;

  // Save to chat history
  await addChatEntry('greeting', script, { type: 'icebreaker', meetingContext });

  return { title, script };
}
