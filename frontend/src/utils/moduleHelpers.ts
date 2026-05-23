import React from 'react';
import {
  Assignment,
  Quiz,
  Forum,
  Description,
  Book,
  School,
  Folder,
} from '@mui/icons-material';

/**
 * Module icon mapping
 * Centralizes icon selection logic
 */
export const MODULE_ICONS: Record<string, React.ReactElement> = {
  'assign': React.createElement(Assignment),
  'quiz': React.createElement(Quiz),
  'forum': React.createElement(Forum),
  'resource': React.createElement(Description),
  'page': React.createElement(Description),
  'book': React.createElement(Book),
  'lesson': React.createElement(School),
  'scorm': React.createElement(Folder),
  'url': React.createElement(Description),
  'folder': React.createElement(Folder),
  'label': React.createElement(Description),
};

/**
 * Module type name mapping
 * Centralizes display name logic
 */
export const MODULE_TYPE_NAMES: Record<string, string> = {
  'assign': 'Assignment',
  'quiz': 'Quiz',
  'forum': 'Forum',
  'resource': 'File',
  'page': 'Page',
  'book': 'Book',
  'lesson': 'Lesson',
  'scorm': 'SCORM Package',
  'url': 'URL',
  'folder': 'Folder',
  'label': 'Label',
};

/**
 * Get icon for a module type
 */
export const getModuleIcon = (modulename: string): React.ReactElement => {
  return MODULE_ICONS[modulename] || MODULE_ICONS['resource'];
};

/**
 * Get display name for a module type
 */
export const getModuleTypeName = (modulename: string): string => {
  return MODULE_TYPE_NAMES[modulename] || modulename;
};
