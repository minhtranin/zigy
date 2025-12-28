import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { MeetingContext } from '../types';
import { USER_ROLES, MEETING_TYPES, MEETING_SIZES, formatMeetingContextForAI } from '../constants/meetingOptions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (context: string, structuredContext: MeetingContext) => void;
  initialContext?: MeetingContext;
}

const DEFAULT_CONTEXT: MeetingContext = {
  userRole: 'candidate',
  userName: '',
  meetingType: 'job_interview',
  meetingSize: 2,
  additionalContext: '',
};

const selectClassName = "w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]";
const optionClassName = "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100";
const inputClassName = "w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500";
const labelClassName = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

export function InitMeetingModal({ isOpen, onClose, onSave, initialContext }: Props) {
  const [formData, setFormData] = useState<MeetingContext>(initialContext || DEFAULT_CONTEXT);
  const [customRole, setCustomRole] = useState('');
  const [customMeetingType, setCustomMeetingType] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialContext) {
        setFormData(initialContext);
        // Check if the role is a custom one (not in predefined list)
        const isCustomRole = !USER_ROLES.find(r => r.value === initialContext.userRole);
        if (isCustomRole && initialContext.userRole) {
          setCustomRole(initialContext.userRole);
          setFormData(prev => ({ ...prev, userRole: 'other' }));
        }
        // Check if the meeting type is a custom one
        const isCustomType = !MEETING_TYPES.find(t => t.value === initialContext.meetingType);
        if (isCustomType && initialContext.meetingType) {
          setCustomMeetingType(initialContext.meetingType);
          setFormData(prev => ({ ...prev, meetingType: 'other' }));
        }
      } else {
        setFormData(DEFAULT_CONTEXT);
        setCustomRole('');
        setCustomMeetingType('');
      }
    }
  }, [isOpen, initialContext]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Build the final context with custom values if needed
    const finalContext: MeetingContext = {
      ...formData,
      userRole: formData.userRole === 'other' ? customRole : formData.userRole,
      meetingType: formData.meetingType === 'other' ? customMeetingType : formData.meetingType,
    };

    // Generate formatted string for AI
    const formattedContext = formatMeetingContextForAI(finalContext);

    onSave(formattedContext, finalContext);
    onClose();
  };

  const handleClear = () => {
    setFormData(DEFAULT_CONTEXT);
    setCustomRole('');
    setCustomMeetingType('');
    onSave('', DEFAULT_CONTEXT);
    onClose();
  };

  const updateField = <K extends keyof MeetingContext>(field: K, value: MeetingContext[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Check if form has meaningful data
  const hasData = formData.userName.trim() ||
    (formData.userRole && formData.userRole !== 'other') ||
    (formData.userRole === 'other' && customRole.trim()) ||
    (formData.meetingType && formData.meetingType !== 'other') ||
    (formData.meetingType === 'other' && customMeetingType.trim()) ||
    formData.additionalContext.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Initialize Meeting Context
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Set up your meeting context for better AI assistance. The AI will use this information to generate more relevant suggestions, greetings, and responses.
          </p>

          {/* Form Grid */}
          <div className="space-y-4">
            {/* Row 1: Role and Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User Role */}
              <div>
                <label className={labelClassName}>Your Role</label>
                <select
                  value={formData.userRole}
                  onChange={(e) => updateField('userRole', e.target.value)}
                  className={selectClassName}
                >
                  {USER_ROLES.map(role => (
                    <option key={role.value} value={role.value} className={optionClassName}>
                      {role.label}
                    </option>
                  ))}
                </select>
                {formData.userRole === 'other' && (
                  <input
                    type="text"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="Enter your role..."
                    className={`${inputClassName} mt-2`}
                    autoFocus
                  />
                )}
              </div>

              {/* User Name */}
              <div>
                <label className={labelClassName}>Your Name</label>
                <input
                  type="text"
                  value={formData.userName}
                  onChange={(e) => updateField('userName', e.target.value)}
                  placeholder="Enter your name..."
                  className={inputClassName}
                />
              </div>
            </div>

            {/* Row 2: Meeting Type and Size */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Meeting Type */}
              <div>
                <label className={labelClassName}>Meeting Type</label>
                <select
                  value={formData.meetingType}
                  onChange={(e) => updateField('meetingType', e.target.value)}
                  className={selectClassName}
                >
                  {MEETING_TYPES.map(type => (
                    <option key={type.value} value={type.value} className={optionClassName}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {formData.meetingType === 'other' && (
                  <input
                    type="text"
                    value={customMeetingType}
                    onChange={(e) => setCustomMeetingType(e.target.value)}
                    placeholder="Enter meeting type..."
                    className={`${inputClassName} mt-2`}
                  />
                )}
              </div>

              {/* Meeting Size */}
              <div>
                <label className={labelClassName}>Meeting Size</label>
                <select
                  value={formData.meetingSize}
                  onChange={(e) => updateField('meetingSize', parseInt(e.target.value, 10))}
                  className={selectClassName}
                >
                  {MEETING_SIZES.map(size => (
                    <option key={size.value} value={size.value} className={optionClassName}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Additional Context */}
            <div>
              <label className={labelClassName}>
                Additional Context <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={formData.additionalContext}
                onChange={(e) => updateField('additionalContext', e.target.value)}
                placeholder="Any additional context about the meeting, topics to discuss, or specific goals..."
                className={`${inputClassName} resize-y min-h-[80px]`}
                rows={3}
              />
            </div>
          </div>

          {/* Preview */}
          {hasData && (
            <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-md border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                Context Preview:
              </p>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {formatMeetingContextForAI({
                  ...formData,
                  userRole: formData.userRole === 'other' ? customRole : formData.userRole,
                  meetingType: formData.meetingType === 'other' ? customMeetingType : formData.meetingType,
                })}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            Clear Context
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasData}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Context
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
