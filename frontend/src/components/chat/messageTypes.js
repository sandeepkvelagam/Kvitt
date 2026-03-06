/**
 * Structured Message Types for AI Chat
 *
 * Versioned contract between backend and frontend for
 * rendering rich, interactive AI assistant messages.
 * Ported from mobile/src/components/chat/messageTypes.ts
 */

export const SCHEMA_VERSION = 1;

export const STRUCTURED_MESSAGE_TYPES = {
  OPTION_SELECTOR: "option_selector",
  TEXT_INPUT_PROMPT: "text_input_prompt",
  CONFIRMATION: "confirmation",
  INFO_CARD: "info_card",
};

/**
 * Create a FlowEvent to send back to the backend.
 * @param {object} content - The StructuredContent from the message
 * @param {number} step - The flow step
 * @param {string} action - e.g. "option_selected", "text_submitted", "submit", "cancel"
 * @param {string} value - The selected/submitted value
 * @returns {object} FlowEvent
 */
export function createFlowEvent(content, step, action, value) {
  return {
    flow_id: content.flow_id || "",
    step: step ?? content.flow_step ?? 0,
    action,
    value,
    flow_data: content.flow_data || {},
    interaction_id: `${content.flow_id || "flow"}_${step ?? 0}_${Date.now()}`,
  };
}
