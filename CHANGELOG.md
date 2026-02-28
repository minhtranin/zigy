# Changelog

All notable changes to Zigy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-03-01

### Fixed
- Fixed VCRUNTIME140.dll missing error on Windows by statically linking the CRT runtime
- Fixed app crash caused by excessive stdout logging — removed per-caption terminal logging that flooded the console

## [1.0.4] - 2026-01-22

### Added
- **Quick chat focus**: Press "s" key anywhere in the app to instantly focus the chat input
- **Three chat modes**: Tab key now cycles through Script → Info → Talk modes
- **Manual mode control**: Removed auto-detect intent - users manually switch modes for better control

### Changed
- Chat modes are now manually controlled via Tab key or mode button instead of automatic detection
- Dynamic suggestions now generate action requests rather than literal phrases
- Pressing "s" provides quick access to chat input from anywhere in the app

### Fixed
- Fixed TypeScript error related to missing translation key
- Improved user experience with intentional mode selection instead of auto-detection

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
