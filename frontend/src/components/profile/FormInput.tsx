import React from 'react';
import { Edit2 } from 'lucide-react';

interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  showCharCount?: boolean;
  charCount?: number;
  multiline?: boolean;
  rows?: number;
  showEditIcon?: boolean;
}

export function FormInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  showCharCount = false,
  charCount,
  multiline = false,
  rows = 4,
  showEditIcon = true,
}: FormInputProps) {
  const displayLabel = showCharCount && maxLength
    ? `${label}（${charCount ?? value.length}/${maxLength}文字以内）`
    : label;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
    onChange(newValue);
  };

  const inputClassName = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F3A7A7] focus:border-transparent";
  const fontStyle = { fontFamily: 'Noto Sans JP, sans-serif' };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {displayLabel}
      </label>
      <div className="relative">
        {multiline ? (
          <textarea
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLength}
            className={`${inputClassName} resize-none`}
            style={fontStyle}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            maxLength={maxLength}
            className={inputClassName}
            style={fontStyle}
          />
        )}
        {showEditIcon && (
          <button
            type="button"
            className={`absolute right-3 ${multiline ? 'top-3' : 'top-1/2 -translate-y-1/2'} text-gray-400 hover:text-gray-600`}
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
