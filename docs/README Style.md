# Styling Guide

A comprehensive guide to styling the MCP-enabled chat interface to achieve a clean, professional look similar to modern AI chat interfaces.

## Table of Contents
- [Core Design Principles](#core-design-principles)
- [Color Palette](#color-palette)
- [Typography](#typography)
- [Layout](#layout)
- [Component-Specific Styles](#component-specific-styles)
- [Animations](#animations)
- [Responsive Design](#responsive-design)
- [Dark Mode](#dark-mode)
- [Accessibility](#accessibility)

## Core Design Principles

### Layout Philosophy
- Clean, minimal design
- Generous white space
- Clear visual hierarchy
- Smooth transitions
- Focus on readability

### Visual Hierarchy
1. Primary content (messages, artifacts)
2. Interactive elements (inputs, buttons)
3. Supporting UI (toolbars, controls)
4. Metadata and timestamps

## Color Palette

### Primary Colors
```css
:root {
  /* Brand Colors */
  --primary-50: #eff6ff;  /* Lightest blue */
  --primary-100: #dbeafe;
  --primary-200: #bfdbfe;
  --primary-500: #3b82f6;  /* Primary blue */
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;  /* Darkest blue */

  /* Neutrals */
  --neutral-50: #f9fafb;   /* Lightest gray */
  --neutral-100: #f3f4f6;
  --neutral-200: #e5e7eb;
  --neutral-300: #d1d5db;
  --neutral-500: #6b7280;
  --neutral-700: #374151;
  --neutral-900: #111827;  /* Darkest gray */
}
```

### Semantic Colors
```css
:root {
  /* Status Colors */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;

  /* Message Colors */
  --user-message-bg: var(--primary-500);
  --user-message-text: white;
  --assistant-message-bg: white;
  --assistant-message-border: var(--neutral-200);
}
```

## Typography

### Font Stacks
```css
:root {
  --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 
               "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 
               "Liberation Mono", "Courier New", monospace;
}
```

### Text Sizes
```css
:root {
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
}
```

## Layout

### Container Sizes
```css
.chat-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.message-container {
  max-width: 75%;  /* Keeps messages from stretching too wide */
}

.artifact-window {
  width: 50%;      /* When open */
  min-width: 320px;
}
```

### Spacing Scale
```css
:root {
  --spacing-1: 0.25rem;  /* 4px */
  --spacing-2: 0.5rem;   /* 8px */
  --spacing-3: 0.75rem;  /* 12px */
  --spacing-4: 1rem;     /* 16px */
  --spacing-6: 1.5rem;   /* 24px */
  --spacing-8: 2rem;     /* 32px */
}
```

## Component-Specific Styles

### Chat Messages

#### User Message
```css
.message-user {
  @apply bg-blue-500 text-white rounded-lg p-4 max-w-3/4 ml-auto;
}
```

#### Assistant Message
```css
.message-assistant {
  @apply bg-white border border-gray-200 rounded-lg p-4 max-w-3/4;
}
```

### Input Area
```css
.chat-input {
  @apply border-t border-gray-200 p-4;
}

.input-field {
  @apply w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 
         focus:ring-blue-500 focus:border-transparent;
}

.send-button {
  @apply bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 
         transition-colors duration-200;
}
```

### Artifact Window

#### Sidebar
```css
.artifact-sidebar {
  @apply w-64 border-r border-gray-200 overflow-y-auto;
}

.artifact-item {
  @apply w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200;
}

.artifact-item-selected {
  @apply bg-blue-50;
}
```

#### Content Area
```css
.artifact-content {
  @apply flex-1 overflow-y-auto p-4;
}

.code-block {
  @apply bg-gray-50 p-4 rounded-lg font-mono text-sm;
}
```

## Animations

### Transitions
```css
:root {
  --transition-fast: 150ms;
  --transition-normal: 250ms;
  --transition-slow: 350ms;
}

.transition-base {
  @apply transition-all duration-250 ease-in-out;
}
```

### Common Animations
```css
/* Artifact window slide */
.artifact-window-enter {
  transform: translateX(100%);
}
.artifact-window-enter-active {
  transform: translateX(0);
  transition: transform var(--transition-normal) ease-out;
}

/* Message fade in */
.message-enter {
  opacity: 0;
  transform: translateY(10px);
}
.message-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity var(--transition-fast) ease-out,
              transform var(--transition-fast) ease-out;
}
```

## Responsive Design

### Breakpoints
```css
:root {
  --screen-sm: 640px;
  --screen-md: 768px;
  --screen-lg: 1024px;
  --screen-xl: 1280px;
}
```

### Mobile Adaptations
```css
/* On small screens, artifact window takes full width */
@media (max-width: 768px) {
  .artifact-window {
    @apply fixed inset-0 w-full;
  }
  
  .message-container {
    @apply max-w-full;
  }
}
```

## Dark Mode

### Color Adjustments
```css
:root[data-theme="dark"] {
  /* Background colors */
  --bg-primary: #1a1b1e;
  --bg-secondary: #2d2d2d;
  
  /* Text colors */
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  
  /* Border colors */
  --border-color: #404040;
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Auto dark mode styles */
  }
}
```

## Accessibility

### Focus States
```css
/* Visible focus rings */
:focus-visible {
  @apply outline-none ring-2 ring-blue-500 ring-offset-2;
}

/* High contrast support */
@media (forced-colors: active) {
  .button {
    @apply border-current;
  }
}
```

### ARIA Support
```css
/* Hide elements visually but keep them available for screen readers */
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
}
```

## Implementation Examples

### Message Component
```tsx
const Message: React.FC<MessageProps> = ({ role, content }) => (
  <div
    className={clsx(
      'mb-4',
      role === 'user' ? 'flex justify-end' : 'flex justify-start'
    )}
  >
    <div
      className={clsx(
        'max-w-3/4 rounded-lg p-4',
        role === 'user'
          ? 'bg-blue-500 text-white'
          : 'bg-white border border-gray-200'
      )}
    >
      {content}
    </div>
  </div>
);
```

### Input Component
```tsx
const ChatInput: React.FC = () => (
  <form className="border-t border-gray-200 p-4">
    <div className="flex space-x-4">
      <input
        type="text"
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Type a message..."
      />
      <button
        type="submit"
        className="bg-blue-500 text-white px-6 py-2 rounded-lg
                   hover:bg-blue-600 transition-colors duration-200"
      >
        Send
      </button>
    </div>
  </form>
);
```

This styling guide provides a foundation for creating a polished, professional chat interface. All styles use Tailwind CSS classes but can be adapted to other styling solutions as needed.

Remember to:
- Keep styles consistent across components
- Maintain accessibility
- Test responsive behavior
- Consider dark mode support
- Use semantic HTML
- Follow accessibility best practices

Would you like me to expand on any particular aspect or add more examples?