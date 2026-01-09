# Changelog

All notable changes to Zigy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-01-09

### Fixed
- **Dynamic Context Suggestions**: Fixed dynamic context suggestions to provide relevant, context-aware responses instead of just echoing the suggestion phrase
  - Updated suggestion generation to create action requests (e.g., "Tell me more about the previous topic") instead of literal phrases
  - Removed "Help me say:" wrapper that was causing Gemini to echo phrases instead of elaborating on context
  - Dynamic suggestions now leverage full conversation history to provide meaningful, contextual responses
  - Example: When clicking "Tell me more detail" after introducing yourself, Gemini now provides more details about your introduction instead of just saying "Tell me more about that"

### Changed
- Dynamic suggestion prompts are now context-aware action requests that work with the full conversation context
- Improved prompt generation for both English and non-English (Vietnamese) dynamic suggestions
- Static/default suggestions remain unchanged and continue to work as before

## [1.0.0] - Previous Release

Initial release of Zigy - Real-time speech-to-text captions desktop app.
