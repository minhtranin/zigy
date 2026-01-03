interface Props {
  text: string;
  fontSize: number;
}

export function TranscriptionDisplay({ text, fontSize }: Props) {
  return (
    <div className="p-3 bg-white dark:bg-[#0D1117] rounded-lg border border-gray-200 dark:border-[#30363D] min-h-[80px]">
      <div className="text-xs text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-1.5">
        transcription (live)
      </div>
      {text ? (
        <div className="text-gray-900 dark:text-[#E6EDF3] leading-snug" style={{ fontSize: `${fontSize}px` }}>
          {text.toLowerCase()}
        </div>
      ) : (
        <div className="text-gray-400 dark:text-[#7D8590] italic" style={{ fontSize: `${fontSize}px` }}>
          waiting for speech...
        </div>
      )}
    </div>
  );
}
