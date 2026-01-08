/*
 * Kolacik Theme
 * Near-black background with orange keywords and teal strings
 * Designed for Operator Mono
 */
import { tags as t } from '@lezer/highlight';
import { createTheme } from './theme-helper.mjs';

export const settings = {
  background: '#0a0e14',
  lineBackground: '#0a0e1499',
  foreground: '#b3b1ad',
  caret: '#e6b450',
  selection: '#1a1f29',
  selectionMatch: '#1a1f29',
  gutterBackground: '#0a0e14',
  gutterForeground: '#3b4048',
  gutterBorder: 'transparent',
  lineHighlight: '#0d1117',
};

export default createTheme({
  theme: 'dark',
  settings,
  styles: [
    // Keywords: orange (export, function, const, if, return, for, let)
    { tag: t.keyword, color: '#d19a66', fontStyle: 'italic' },

    // Strings: teal/cyan italic
    { tag: [t.string, t.special(t.string)], color: '#56b6c2', fontStyle: 'italic' },

    // Comments: gray italic
    { tag: t.comment, color: '#5c6370', fontStyle: 'italic' },

    // Functions: blue
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#61afef' },

    // Variables: red/coral
    { tag: t.variableName, color: '#e06c75' },

    // Properties: light blue
    { tag: [t.propertyName, t.labelName], color: '#7eb8db' },

    // Numbers: orange
    { tag: t.number, color: '#d19a66' },

    // Operators: cyan
    { tag: t.operator, color: '#56b6c2' },

    // Booleans, atoms: orange
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#d19a66' },

    // Class names: yellow
    { tag: t.className, color: '#e5c07b' },

    // Type names: yellow
    { tag: t.typeName, color: '#e5c07b' },

    // Tags: red
    { tag: t.tagName, color: '#e06c75' },

    // Attributes: orange
    { tag: t.attributeName, color: '#d19a66' },

    // Brackets: muted
    { tag: t.bracket, color: '#4b5263' },

    // Punctuation: muted
    { tag: t.punctuation, color: '#6b7280' },

    // Definition names (function names being defined): blue
    { tag: t.definition(t.variableName), color: '#61afef' },

    // Meta
    { tag: t.meta, color: '#6b7280' },
  ],
});
