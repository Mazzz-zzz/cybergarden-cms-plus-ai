# TinaCMS AI Chatbot Extension - Developer Reference

This document serves as a technical reference for the AI Chatbot features integrated into TinaCMS (`cg-forged-tina`).

## 🧠 Architecture Overview

The AI assistant is embedded directly into the TinaCMS form builder, leveraging `assistant-ui` for the chat interface and `OpenRouter` for LLM connectivity. It provides context-aware editing capabilities for rich-text and other fields.

### Core Components

*   **UI Component**: `EmbeddedChatbot` in `EmbeddedChatbot.tsx`.
*   **Logic Handler**: `ChatbotContextApplier` logic in `form-builder.tsx`.
*   **State Management**: `assistant-ui` local runtime with custom adapters.

---

## 🛠️ Feature Breakdown

### 1. Two-Tier Tool System

The chatbot uses structured tool calling to modify content, ensuring valid and parseable edits.

| Tool Name | Purpose | Parameters | Handler Location |
| :--- | :--- | :--- | :--- |
| **`apply_edit`** | Targeted text replacements | `search` (string), `replace` (string), `all` (boolean) | `form-builder.tsx` |
| **`rewrite_content`** | Full content transformation | `new_content` (string) | `form-builder.tsx` |

*   **Auto-Apply**: Tool calls are automatically intercepted in the `adapter.run` loop. Events (`tinacms-tool-apply-edit`, `tinacms-tool-rewrite-content`) are dispatched to the form builder to apply changes to the form state.

### 2. Context Locking & Reset

To prevent context drift and ensure stability:

*   **Context Locking**: Once a message is sent, the context selector (e.g., "Body", "Title") is **locked**. The user cannot switch fields mid-chat.
    *   *Implementation*: Tracks `contextLocked` state and disables context chips.
*   **Reset Mechanism**: A "Reset" button allows clearing the chat and unlocking headers.
    *   *Implementation*: Uses `runtime.switchToNewThread()` via a `ThreadResetter` component to cleanly reset the `assistant-ui` state without unmounting the component (which would break the input).

### 3. Context-Aware Targeting

To ensure edits apply to the correct field (especially after switching contexts):

1.  **Selection Tracking**: `EmbeddedChatbot.tsx` tracks the currently selected context using a `ref` (`selectedContextRef`) to ensure the callback always has the freshest state.
2.  **Event Payload**: When a tool is called, the `fieldName` of the *currently selected context* is passed in the event detail.
3.  **Targeting Logic**: The event handler in `form-builder.tsx` prioritizes this explicit `fieldName` over heuristic guessing (e.g., finding the first "body" field).

---

## 📂 Key Files & Responsibilities

### `packages/tinacms/src/toolkit/form-builder/EmbeddedChatbot.tsx`
*   **Chat Interface**: Renders the chat UI, messages, and input.
*   **Adapter Definition**: Defines the `ChatModelAdapter` that connects to OpenRouter.
*   **Tool Handling**: Intercepts LLM tool calls and dispatches custom DOM events.
*   **Context Management**: Handles context selection, locking, and resetting.

### `packages/tinacms/src/toolkit/form-builder/form-builder.tsx`
*   **Event Listeners**: Listens for `tinacms-tool-apply-edit` and `tinacms-tool-rewrite-content`.
*   **Field Updates**: execution logic to modify the `react-final-form` state.
*   **Rich Text Handling**: Serializes/parses MDX for rich-text fields before applying string manipulations.

---

## ⚙️ Configuration

*   **API Key**: Stored in `localStorage` or `window.__TINACMS_OPENROUTER_API_KEY`.
*   **Model**: Defaults to `google/gemini-2.0-flash-exp:free`, configurable in AI Settings.

## 🐛 Troubleshooting

*   **"Input disabled after reset"**: This was fixed by using `runtime.switchToNewThread()` instead of React key-based re-mounting.
*   **"Edit applied to wrong field"**: Ensure the `fieldName` is correctly passed in the tool event payload. Check `form-builder.tsx` listeners.
