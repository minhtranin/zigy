// Predefined options for the Initialize Meeting Context modal

export const USER_ROLES = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'interviewer', label: 'Interviewer' },
  { value: 'coworker', label: 'Coworker' },
  { value: 'software_engineer', label: 'Software Engineer' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'product_owner', label: 'Product Owner' },
  { value: 'designer', label: 'Designer' },
  { value: 'qa_engineer', label: 'QA Engineer' },
  { value: 'devops_engineer', label: 'DevOps Engineer' },
  { value: 'other', label: 'Other...' },
] as const;

export const MEETING_TYPES = [
  { value: 'job_interview', label: 'Job Interview' },
  { value: 'technical_interview', label: 'Technical Interview' },
  { value: 'behavioral_interview', label: 'Behavioral Interview' },
  { value: 'project_meeting', label: 'Project Meeting' },
  { value: 'team_meeting', label: 'Team Meeting' },
  { value: 'daily_standup', label: 'Daily Standup' },
  { value: 'sprint_planning', label: 'Sprint Planning' },
  { value: 'retrospective', label: 'Retrospective' },
  { value: 'incident_meeting', label: 'Incident Meeting' },
  { value: 'production_issue', label: 'Production Issue' },
  { value: 'code_review', label: 'Code Review' },
  { value: 'explanation_demo', label: 'Explanation/Demo' },
  { value: 'one_on_one', label: '1-on-1' },
  { value: 'client_meeting', label: 'Client Meeting' },
  { value: 'other', label: 'Other...' },
] as const;

export const MEETING_SIZES = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1} ${i === 0 ? 'person' : 'people'}`,
}));

// Helper function to get label from value
export function getRoleLabel(value: string): string {
  const role = USER_ROLES.find(r => r.value === value);
  return role ? role.label : value;
}

export function getMeetingTypeLabel(value: string): string {
  const type = MEETING_TYPES.find(t => t.value === value);
  return type ? type.label : value;
}

// Helper to format meeting context for AI
export function formatMeetingContextForAI(context: {
  userRole: string;
  userName: string;
  meetingType: string;
  meetingSize: number;
  additionalContext: string;
}): string {
  const parts: string[] = [];

  if (context.userName) {
    parts.push(`My name is ${context.userName}.`);
  }

  if (context.userRole && context.userRole !== 'other') {
    const roleLabel = getRoleLabel(context.userRole);
    parts.push(`I am a ${roleLabel}.`);
  } else if (context.userRole) {
    parts.push(`I am a ${context.userRole}.`);
  }

  if (context.meetingType && context.meetingType !== 'other') {
    const typeLabel = getMeetingTypeLabel(context.meetingType);
    parts.push(`This is a ${typeLabel}.`);
  } else if (context.meetingType) {
    parts.push(`This is a ${context.meetingType}.`);
  }

  if (context.meetingSize > 1) {
    parts.push(`There are ${context.meetingSize} people in this meeting.`);
  }

  if (context.additionalContext) {
    parts.push(context.additionalContext);
  }

  return parts.join(' ');
}
