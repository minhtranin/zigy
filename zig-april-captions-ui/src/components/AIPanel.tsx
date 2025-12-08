import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SummaryState, QuestionsState, KnowledgeEntry } from '../types';
import './AIPanel.css';

interface Tab {
  id: string;
  label: string;
}

interface Props {
  summary: SummaryState;
  questions: QuestionsState;
  onGenerateSummary: () => void;
  onClearSummary: () => void;
  onGenerateQuestions: () => void;
  onClearQuestions: () => void;
  hasApiKey: boolean;
  hasTranscript: boolean;
  fontSize: number;
}

const tabs: Tab[] = [
  { id: 'questions', label: 'Questions' },
  { id: 'summary', label: 'Summary' },
  { id: 'examples', label: 'Examples' },
  { id: 'knowledge', label: 'Knowledge' },
];

// Pre-written greeting and warm-up phrases for meetings
const examplePhrases = [
  // Greetings
  { category: 'Greetings', text: "Hi everyone, how's it going?" },
  { category: 'Greetings', text: "Hey team, good to see you all!" },
  { category: 'Greetings', text: "Hello! Hope everyone is doing well today." },
  { category: 'Greetings', text: "Good morning/afternoon everyone!" },
  { category: 'Greetings', text: "Thanks for joining, great to have everyone here." },
  { category: 'Greetings', text: "Hey! Nice to see some familiar faces." },
  { category: 'Greetings', text: "Hi all, thanks for making time for this." },
  { category: 'Greetings', text: "Hello everyone, hope you're having a great day!" },
  // Warm-up / Small Talk
  { category: 'Small Talk', text: "How was your weekend?" },
  { category: 'Small Talk', text: "How's everything going on your end?" },
  { category: 'Small Talk', text: "Did you have a good week so far?" },
  { category: 'Small Talk', text: "How's the weather where you are?" },
  { category: 'Small Talk', text: "Any exciting plans for the weekend?" },
  { category: 'Small Talk', text: "Been up to anything fun lately?" },
  { category: 'Small Talk', text: "How's the family doing?" },
  { category: 'Small Talk', text: "Watched any good shows or movies recently?" },
  { category: 'Small Talk', text: "How are you holding up this week?" },
  { category: 'Small Talk', text: "Getting enough coffee today?" },
  // Check-in
  { category: 'Check-in', text: "How are things going with your current projects?" },
  { category: 'Check-in', text: "Is there anything you need help with?" },
  { category: 'Check-in', text: "Any blockers or challenges we should discuss?" },
  { category: 'Check-in', text: "How's the workload looking for everyone?" },
  { category: 'Check-in', text: "Anything new or exciting to share?" },
  { category: 'Check-in', text: "How's everyone feeling about the deadline?" },
  { category: 'Check-in', text: "Any updates since our last meeting?" },
  { category: 'Check-in', text: "Is everyone on track with their tasks?" },
  { category: 'Check-in', text: "Anything I can do to support you?" },
  { category: 'Check-in', text: "How did that thing we discussed last time go?" },
  // Starting the Meeting
  { category: 'Starting', text: "Shall we get started?" },
  { category: 'Starting', text: "Let's dive into the agenda." },
  { category: 'Starting', text: "Ready to kick things off?" },
  { category: 'Starting', text: "I think we're all here, let's begin." },
  { category: 'Starting', text: "Thanks for your time today, let's get started." },
  { category: 'Starting', text: "Alright, let's jump right in." },
  { category: 'Starting', text: "Let me share my screen and we can begin." },
  { category: 'Starting', text: "Should we wait for anyone else or start now?" },
  // During Meeting
  { category: 'During Meeting', text: "That's a great point, thanks for bringing that up." },
  { category: 'During Meeting', text: "Could you elaborate on that a bit more?" },
  { category: 'During Meeting', text: "I agree with what you're saying." },
  { category: 'During Meeting', text: "That makes sense to me." },
  { category: 'During Meeting', text: "Just to clarify, are you saying...?" },
  { category: 'During Meeting', text: "Can we circle back to that point later?" },
  { category: 'During Meeting', text: "I have a quick question about that." },
  { category: 'During Meeting', text: "What does everyone else think?" },
  { category: 'During Meeting', text: "Let me make sure I understand correctly..." },
  { category: 'During Meeting', text: "That's an interesting perspective." },
  // Ending Meeting
  { category: 'Ending', text: "Thanks everyone for your time today!" },
  { category: 'Ending', text: "Great discussion, let's follow up on this." },
  { category: 'Ending', text: "Any final questions before we wrap up?" },
  { category: 'Ending', text: "I'll send out the meeting notes shortly." },
  { category: 'Ending', text: "Let's reconnect next week to check progress." },
  { category: 'Ending', text: "Thanks for the productive meeting!" },
  { category: 'Ending', text: "Have a great rest of your day, everyone!" },
  { category: 'Ending', text: "Talk to you all soon, take care!" },
];

export function AIPanel({
  summary,
  questions,
  onGenerateSummary,
  onClearSummary,
  onGenerateQuestions,
  onClearQuestions,
  hasApiKey,
  hasTranscript,
  fontSize,
}: Props) {
  const [activeTab, setActiveTab] = useState('questions');
  const canGenerate = hasApiKey && hasTranscript;

  // Knowledge state
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [newKnowledge, setNewKnowledge] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Load knowledge on mount
  useEffect(() => {
    loadKnowledge();
  }, []);

  const loadKnowledge = async () => {
    try {
      const entries = await invoke<KnowledgeEntry[]>('get_knowledge');
      setKnowledgeEntries(entries);
    } catch (e) {
      console.error('Failed to load knowledge:', e);
    }
  };

  const handleAddKnowledge = async () => {
    if (!newKnowledge.trim()) return;

    setIsSaving(true);
    try {
      const entry = await invoke<KnowledgeEntry>('add_knowledge_entry', {
        content: newKnowledge.trim(),
      });
      setKnowledgeEntries([...knowledgeEntries, entry]);
      setNewKnowledge('');
    } catch (e) {
      console.error('Failed to add knowledge:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      await invoke('delete_knowledge_entry', { id });
      setKnowledgeEntries(knowledgeEntries.filter((e) => e.id !== id));
    } catch (e) {
      console.error('Failed to delete knowledge:', e);
    }
  };

  const handleStartEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setEditingContent(entry.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingContent.trim()) return;

    setIsSaving(true);
    try {
      const updated = await invoke<KnowledgeEntry>('update_knowledge_entry', {
        id: editingId,
        content: editingContent.trim(),
      });
      setKnowledgeEntries(
        knowledgeEntries.map((e) => (e.id === editingId ? updated : e))
      );
      setEditingId(null);
      setEditingContent('');
    } catch (e) {
      console.error('Failed to update knowledge:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`ai-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-panel-content">
        {activeTab === 'questions' && (
          <div className="ai-tab-content">
            <div className="ai-actions">
              <button
                className="btn-ai btn-questions"
                onClick={onGenerateQuestions}
                disabled={!canGenerate || questions.isLoading}
              >
                {questions.isLoading ? 'Thinking...' : 'Suggest Questions'}
              </button>
              {questions.questions.length > 0 && (
                <button className="btn-ai-clear" onClick={onClearQuestions}>
                  Clear
                </button>
              )}
            </div>

            {questions.error && <div className="ai-error">{questions.error}</div>}

            {questions.questions.length > 0 ? (
              <div className="questions-list">
                {questions.questions.map((q, i) => (
                  <div key={i} className="question-item" style={{ fontSize: `${fontSize}px` }}>
                    <span className="question-number">{i + 1}</span>
                    <span className="question-text">{q}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ai-placeholder" style={{ fontSize: `${fontSize}px` }}>
                {!hasApiKey
                  ? 'Configure Gemini API key in Settings tab'
                  : !hasTranscript
                  ? 'Start a transcription first'
                  : 'Click "Suggest Questions" to get smart questions for the meeting'}
              </div>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="ai-tab-content">
            <div className="ai-actions">
              <button
                className="btn-ai btn-summary"
                onClick={onGenerateSummary}
                disabled={!canGenerate || summary.isLoading}
              >
                {summary.isLoading ? 'Generating...' : 'Generate Summary'}
              </button>
              {summary.content && (
                <button className="btn-ai-clear" onClick={onClearSummary}>
                  Clear
                </button>
              )}
            </div>

            {summary.error && <div className="ai-error">{summary.error}</div>}

            {summary.content ? (
              <div className="summary-content" style={{ fontSize: `${fontSize}px` }}>
                {summary.content}
              </div>
            ) : (
              <div className="ai-placeholder" style={{ fontSize: `${fontSize}px` }}>
                {!hasApiKey
                  ? 'Configure Gemini API key in Settings tab'
                  : !hasTranscript
                  ? 'Start a transcription first'
                  : 'Click "Generate Summary" to create an AI summary of your transcript'}
              </div>
            )}

            {summary.lastGeneratedAt && (
              <div className="ai-timestamp">
                Generated at {new Date(summary.lastGeneratedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="ai-tab-content examples-content">
            <div className="examples-intro" style={{ fontSize: `${fontSize}px` }}>
              Quick phrases for meeting greetings and warm-ups
            </div>

            {['Greetings', 'Small Talk', 'Check-in', 'Starting', 'During Meeting', 'Ending'].map((category) => (
              <div key={category} className="example-category">
                <div className="category-title">{category}</div>
                <div className="example-list">
                  {examplePhrases
                    .filter((p) => p.category === category)
                    .map((phrase, i) => (
                      <div
                        key={i}
                        className="example-item"
                        style={{ fontSize: `${fontSize}px` }}
                      >
                        {phrase.text}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="ai-tab-content knowledge-content">
            <div className="knowledge-intro" style={{ fontSize: `${fontSize}px` }}>
              Add your own knowledge for AI to reference in future responses
            </div>

            <div className="knowledge-input-section">
              <textarea
                className="knowledge-input"
                placeholder="Enter your knowledge here... (e.g., project details, team info, terminology)"
                value={newKnowledge}
                onChange={(e) => setNewKnowledge(e.target.value)}
                rows={3}
                style={{ fontSize: `${fontSize}px` }}
              />
              <button
                className="btn-ai btn-knowledge"
                onClick={handleAddKnowledge}
                disabled={!newKnowledge.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>

            {knowledgeEntries.length > 0 ? (
              <div className="knowledge-list">
                <div className="knowledge-list-header">
                  Saved Knowledge ({knowledgeEntries.length})
                </div>
                {knowledgeEntries.map((entry) => (
                  <div key={entry.id} className="knowledge-item">
                    {editingId === entry.id ? (
                      <>
                        <textarea
                          className="knowledge-edit-input"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={3}
                          style={{ fontSize: `${fontSize}px` }}
                          autoFocus
                        />
                        <div className="knowledge-footer">
                          <button
                            className="btn-knowledge-action btn-save"
                            onClick={handleSaveEdit}
                            disabled={isSaving || !editingContent.trim()}
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className="btn-knowledge-action btn-cancel"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="knowledge-content" style={{ fontSize: `${fontSize}px` }}>
                          {entry.content}
                        </div>
                        <div className="knowledge-footer">
                          <span className="knowledge-date">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                          <div className="knowledge-actions">
                            <button
                              className="btn-knowledge-action btn-edit"
                              onClick={() => handleStartEdit(entry)}
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              className="btn-knowledge-action btn-delete"
                              onClick={() => handleDeleteKnowledge(entry.id)}
                              title="Delete"
                            >
                              x
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="ai-placeholder" style={{ fontSize: `${fontSize}px` }}>
                No knowledge saved yet. Add information above to help AI provide better responses.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
