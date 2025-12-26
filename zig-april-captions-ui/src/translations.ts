import { AppLanguage } from './types';

export interface Translations {
  // App Header
  appName: string;
  captionsTab: string;
  settingsTab: string;
  aboutTab: string;

  // History Display
  history: string;
  words: string;
  edit: string;
  delete: string;
  ask: string;
  answer: string;
  talk: string;
  translate: string;
  generating: string;
  translating: string;
  hide: string;
  historyPlaceholder: string;
  compact: string;

  // Control Bar
  start: string;
  stop: string;
  clear: string;
  ready: string;
  listening: string;
  noModelSelected: string;

  // Settings Panel
  speechRecognition: string;
  asrModel: string;
  browse: string;
  audioSource: string;
  microphone: string;
  systemAudio: string;
  aiSettings: string;
  apiKey: string;
  apiKeyPlaceholder: string;
  aiModel: string;
  translation: string;
  display: string;
  theme: string;
  switchTo: string;
  lightMode: string;
  darkMode: string;
  fontSize: string;
  data: string;
  export: string;
  exporting: string;
  exportCaptions: string;
  appLanguage: string;

  // AI Panel - Questions Tab
  questionsTab: string;
  suggestQuestions: string;
  thinking: string;
  aiSuggested: string;
  askedAbout: string;
  about: string;
  noApiKey: string;
  noTranscript: string;
  suggestQuestionsHint: string;

  // AI Panel - Summary Tab
  summaryTab: string;
  generateSummary: string;
  generatedAt: string;
  generateSummaryHint: string;

  // AI Panel - Examples Tab
  examplesTab: string;
  examplesDescription: string;
  greetings: string;
  smallTalk: string;
  checkIn: string;
  starting: string;
  duringMeeting: string;
  ending: string;

  // AI Panel - Knowledge Tab
  knowledgeTab: string;
  knowledgeDescription: string;
  knowledgePlaceholder: string;
  save: string;
  saving: string;
  savedKnowledge: string;
  nominated: string;
  noKnowledge: string;

  // AI Panel - Ideas Section
  ideasPlaceholder: string;
  generate: string;
  aiGenerated: string;
  raw: string;
  script: string;

  // Timeline (unified Ideas tab)
  ideasTab: string;
  timeline: string;
  noTimelineItems: string;
  timelineHint: string;
  summaryTitle: string;
  questionsTitle: string;
  ideaTitle: string;
  generateSummaryBtn: string;
  generateQuestionsBtn: string;

  // Chat Tab (replaces Ideas)
  chatTab: string;
  chatPlaceholder: string;
  pleaseConfigureApiKey: string;

  // Chat Panel UI
  contextSuggestions: string;
  whatToSayNext: string;
  respondToLastPoint: string;
  addMyOpinion: string;
  talkModeHint: string;
  talkModePlaceholder: string;
  askMeAnything: string;
  meetingAssistant: string;
  trySuggestion: string;
  translateToLanguage: string;

  // About Panel
  aboutTitle: string;
  contact: string;
  email: string;
  support: string;
  buyMeACoffee: string;
  githubSupport: string;

  // Knowledge Panel (Top-level tab)
  newNote: string;
  searchNotes: string;
  searchNotesPlaceholder: string;
  noNotesFound: string;
  untitledNote: string;
  editMode: string;
  previewMode: string;
  deleteNote: string;
  confirmDeleteNote: string;
  nominateNote: string;
  unnominateNote: string;
  nominatedNotes: string;
  allNotes: string;
  noteAutoSaved: string;
  noteSaving: string;
  noNotesYet: string;
  addFirstNote: string;
  noteCreated: string;
}

export const translations: Record<AppLanguage, Translations> = {
  en: {
    // App Header
    appName: 'Zigy',
    captionsTab: 'Captions',
    settingsTab: 'Settings',
    aboutTab: 'About',

    // History Display
    history: 'History',
    words: 'words',
    edit: 'Edit',
    delete: 'Delete',
    ask: 'Ask',
    answer: 'Answer',
    talk: 'Talk',
    translate: 'Translate',
    generating: 'Generating...',
    translating: 'Translating...',
    hide: 'Hide',
    historyPlaceholder: 'History will appear here...',
    compact: 'Compact',

    // Control Bar
    start: 'Start',
    stop: 'Stop',
    clear: 'Clear',
    ready: 'Ready',
    listening: 'Listening',
    noModelSelected: 'No model selected',

    // Settings Panel
    speechRecognition: 'Speech Recognition',
    asrModel: 'ASR Model',
    browse: 'Browse',
    audioSource: 'Audio Source',
    microphone: 'Microphone',
    systemAudio: 'System Audio',
    aiSettings: 'AI Settings (Gemini)',
    apiKey: 'API Key',
    apiKeyPlaceholder: 'Enter Gemini API key',
    aiModel: 'AI Model',
    translation: 'Translation',
    display: 'Display',
    theme: 'Theme',
    switchTo: 'Switch to',
    lightMode: 'Light',
    darkMode: 'Dark',
    fontSize: 'Font Size',
    data: 'Data',
    export: 'Export',
    exporting: 'Exporting...',
    exportCaptions: 'Export Captions',
    appLanguage: 'App Language',

    // AI Panel - Questions Tab
    questionsTab: 'Questions',
    suggestQuestions: 'Suggest Questions',
    thinking: 'Thinking...',
    aiSuggested: 'AI Suggested',
    askedAbout: 'Asked About',
    about: 'About',
    noApiKey: 'Configure Gemini API key in Settings tab',
    noTranscript: 'Start a transcription first',
    suggestQuestionsHint: 'Click "Suggest Questions" to get smart questions for the meeting, or click "Ask" on any transcript line',

    // AI Panel - Summary Tab
    summaryTab: 'Summary',
    generateSummary: 'Generate Summary',
    generatedAt: 'Generated at',
    generateSummaryHint: 'Click "Generate Summary" to create an AI summary of your transcript',

    // AI Panel - Examples Tab
    examplesTab: 'Examples',
    examplesDescription: 'Quick phrases for meeting greetings and warm-ups',
    greetings: 'Greetings',
    smallTalk: 'Small Talk',
    checkIn: 'Check-in',
    starting: 'Starting',
    duringMeeting: 'During Meeting',
    ending: 'Ending',

    // AI Panel - Knowledge Tab
    knowledgeTab: 'Knowledge',
    knowledgeDescription: 'Add your own knowledge for AI to reference in future responses',
    knowledgePlaceholder: 'Enter your knowledge here... (e.g., project details, team info, terminology)',
    save: 'Save',
    saving: 'Saving...',
    savedKnowledge: 'Saved Knowledge',
    nominated: 'Nominated',
    noKnowledge: 'No knowledge saved yet. Add information above to help AI provide better responses.',

    // AI Panel - Ideas Section
    ideasPlaceholder: "Type your raw idea (don't worry about grammar)... AI will auto-generate a title for you!",
    generate: 'Generate',
    aiGenerated: 'AI Generated',
    raw: 'Raw',
    script: 'Script',

    // Timeline (unified Ideas tab)
    ideasTab: 'Ideas',
    timeline: 'Timeline',
    noTimelineItems: 'No timeline items yet',
    timelineHint: 'Generate a summary or questions from the buttons above, or create an idea below',
    summaryTitle: 'Summary',
    questionsTitle: 'Questions',
    ideaTitle: 'Idea',
    generateSummaryBtn: 'Summary',
    generateQuestionsBtn: 'Questions',

    // Chat Tab (replaces Ideas)
    chatTab: 'Chat',
    chatPlaceholder: 'Type a message or /ask, /answer, /talk, /translate...',
    pleaseConfigureApiKey: 'Please configure your Gemini API key in Settings',

    // Chat Panel UI
    contextSuggestions: 'Context suggestions',
    whatToSayNext: 'What to say next?',
    respondToLastPoint: 'Respond to last point',
    addMyOpinion: 'Add my opinion',
    talkModeHint: 'Talk Mode: Type in any language → Natural English',
    talkModePlaceholder: 'Type in any language → English for speaking...',
    askMeAnything: 'Ask me anything...',
    meetingAssistant: 'Meeting Assistant',
    trySuggestion: 'Try a suggestion or type your message',
    translateToLanguage: 'Translate',

    // About Panel
    aboutTitle: 'About Zigy',
    contact: 'Contact',
    email: 'Email',
    support: 'Support',
    buyMeACoffee: 'Buy Me a Coffee',
    githubSupport: 'GitHub Support',

    // Knowledge Panel (Top-level tab)
    newNote: 'New Note',
    searchNotes: 'Search',
    searchNotesPlaceholder: 'Search notes...',
    noNotesFound: 'No notes found',
    untitledNote: 'Untitled Note',
    editMode: 'Edit',
    previewMode: 'Preview',
    deleteNote: 'Delete',
    confirmDeleteNote: 'Delete this note?',
    nominateNote: 'Nominate for AI',
    unnominateNote: 'Remove nomination',
    nominatedNotes: 'Nominated',
    allNotes: 'All',
    noteAutoSaved: 'Saved',
    noteSaving: 'Saving...',
    noNotesYet: 'No notes yet',
    addFirstNote: 'Create your first note to store knowledge for AI context',
    noteCreated: 'Note created',
  },
  vi: {
    // App Header
    appName: 'Zigy',
    captionsTab: 'Phụ đề',
    settingsTab: 'Cài đặt',
    aboutTab: 'Giới thiệu',

    // History Display
    history: 'Lịch sử',
    words: 'từ',
    edit: 'Sửa',
    delete: 'Xóa',
    ask: 'Hỏi',
    answer: 'Trả lời',
    talk: 'Nói',
    translate: 'Dịch',
    generating: 'Đang tạo...',
    translating: 'Đang dịch...',
    hide: 'Ẩn',
    historyPlaceholder: 'Lịch sử sẽ xuất hiện ở đây...',
    compact: 'Gộp',

    // Control Bar
    start: 'Bắt đầu',
    stop: 'Dừng',
    clear: 'Xóa',
    ready: 'Sẵn sàng',
    listening: 'Đang nghe',
    noModelSelected: 'Chưa chọn mô hình',

    // Settings Panel
    speechRecognition: 'Nhận diện giọng nói',
    asrModel: 'Mô hình ASR',
    browse: 'Chọn',
    audioSource: 'Nguồn âm thanh',
    microphone: 'Microphone',
    systemAudio: 'Âm thanh hệ thống',
    aiSettings: 'Cài đặt AI (Gemini)',
    apiKey: 'API Key',
    apiKeyPlaceholder: 'Nhập Gemini API key',
    aiModel: 'Mô hình AI',
    translation: 'Dịch thuật',
    display: 'Hiển thị',
    theme: 'Giao diện',
    switchTo: 'Chuyển sang',
    lightMode: 'Sáng',
    darkMode: 'Tối',
    fontSize: 'Cỡ chữ',
    data: 'Dữ liệu',
    export: 'Xuất',
    exporting: 'Đang xuất...',
    exportCaptions: 'Xuất phụ đề',
    appLanguage: 'Ngôn ngữ ứng dụng',

    // AI Panel - Questions Tab
    questionsTab: 'Câu hỏi',
    suggestQuestions: 'Gợi ý câu hỏi',
    thinking: 'Đang suy nghĩ...',
    aiSuggested: 'AI gợi ý',
    askedAbout: 'Đã hỏi về',
    about: 'Về',
    noApiKey: 'Vui lòng cấu hình Gemini API key trong tab Cài đặt',
    noTranscript: 'Vui lòng bắt đầu phiên ghi âm trước',
    suggestQuestionsHint: 'Nhấn "Gợi ý câu hỏi" để nhận câu hỏi thông minh cho cuộc họp, hoặc nhấn "Hỏi" trên bất kỳ dòng nào',

    // AI Panel - Summary Tab
    summaryTab: 'Tóm tắt',
    generateSummary: 'Tạo tóm tắt',
    generatedAt: 'Tạo lúc',
    generateSummaryHint: 'Nhấn "Tạo tóm tắt" để tạo bản tóm tắt AI cho bản ghi âm của bạn',

    // AI Panel - Examples Tab
    examplesTab: 'Mẫu câu',
    examplesDescription: 'Các mẫu câu nhanh cho lời chào và khởi động cuộc họp',
    greetings: 'Lời chào',
    smallTalk: 'Trò chuyện',
    checkIn: 'Kiểm tra',
    starting: 'Bắt đầu',
    duringMeeting: 'Trong cuộc họp',
    ending: 'Kết thúc',

    // AI Panel - Knowledge Tab
    knowledgeTab: 'Kiến thức',
    knowledgeDescription: 'Thêm kiến thức của bạn để AI tham khảo trong các phản hồi sau',
    knowledgePlaceholder: 'Nhập kiến thức của bạn... (ví dụ: chi tiết dự án, thông tin nhóm, thuật ngữ)',
    save: 'Lưu',
    saving: 'Đang lưu...',
    savedKnowledge: 'Kiến thức đã lưu',
    nominated: 'Đã chọn',
    noKnowledge: 'Chưa có kiến thức nào. Thêm thông tin ở trên để giúp AI phản hồi tốt hơn.',

    // AI Panel - Ideas Section
    ideasPlaceholder: 'Nhập ý tưởng thô của bạn (không cần lo ngữ pháp)... AI sẽ tự động tạo tiêu đề!',
    generate: 'Tạo',
    aiGenerated: 'AI đã tạo',
    raw: 'Thô',
    script: 'Kịch bản',

    // Timeline (unified Ideas tab)
    ideasTab: 'Ý tưởng',
    timeline: 'Dòng thời gian',
    noTimelineItems: 'Chưa có mục nào',
    timelineHint: 'Tạo tóm tắt hoặc câu hỏi từ các nút ở trên, hoặc tạo ý tưởng bên dưới',
    summaryTitle: 'Tóm tắt',
    questionsTitle: 'Câu hỏi',
    ideaTitle: 'Ý tưởng',
    generateSummaryBtn: 'Tóm tắt',
    generateQuestionsBtn: 'Câu hỏi',

    // Chat Tab (replaces Ideas)
    chatTab: 'Chat',
    chatPlaceholder: 'Nhập tin nhắn hoặc /ask, /answer, /talk, /translate...',
    pleaseConfigureApiKey: 'Vui lòng cấu hình khóa API Gemini trong Cài đặt',

    // Chat Panel UI
    contextSuggestions: 'Gợi ý theo ngữ cảnh',
    whatToSayNext: 'Nói gì tiếp?',
    respondToLastPoint: 'Phản hồi điểm trước',
    addMyOpinion: 'Thêm ý kiến',
    talkModeHint: 'Chế độ nói: Nhập bằng bất kỳ ngôn ngữ nào → Tiếng Anh tự nhiên',
    talkModePlaceholder: 'Nhập bằng bất kỳ ngôn ngữ nào → Tiếng Anh để nói...',
    askMeAnything: 'Hỏi tôi bất cứ điều gì...',
    meetingAssistant: 'Trợ lý cuộc họp',
    trySuggestion: 'Thử một gợi ý hoặc nhập tin nhắn',
    translateToLanguage: 'Dịch',

    // About Panel
    aboutTitle: 'Về Zigy',
    contact: 'Liên hệ',
    email: 'Email',
    support: 'Hỗ trợ',
    buyMeACoffee: 'Mua cho tôi cà phê',
    githubSupport: 'Hỗ trợ GitHub',

    // Knowledge Panel (Top-level tab)
    newNote: 'Ghi chú mới',
    searchNotes: 'Tìm kiếm',
    searchNotesPlaceholder: 'Tìm ghi chú...',
    noNotesFound: 'Không tìm thấy ghi chú',
    untitledNote: 'Ghi chú không tên',
    editMode: 'Sửa',
    previewMode: 'Xem trước',
    deleteNote: 'Xóa',
    confirmDeleteNote: 'Xóa ghi chú này?',
    nominateNote: 'Chọn cho AI',
    unnominateNote: 'Bỏ chọn',
    nominatedNotes: 'Đã chọn',
    allNotes: 'Tất cả',
    noteAutoSaved: 'Đã lưu',
    noteSaving: 'Đang lưu...',
    noNotesYet: 'Chưa có ghi chú',
    addFirstNote: 'Tạo ghi chú đầu tiên để lưu kiến thức cho AI',
    noteCreated: 'Đã tạo ghi chú',
  },
};

export function getTranslations(language: AppLanguage): Translations {
  return translations[language];
}
