import React from "react";
import { STRUCTURED_MESSAGE_TYPES, createFlowEvent } from "./messageTypes";
import {
  OptionSelectorCard,
  TextInputPromptCard,
  ConfirmationCard,
  InfoCard,
} from "./StructuredCards";

/**
 * StructuredMessageRenderer — Dispatches structured content to the correct card.
 * Ported from mobile/src/components/chat/StructuredMessageRenderer.tsx
 *
 * @param {object} props
 * @param {object} props.content - StructuredContent from backend
 * @param {boolean} props.isLatest - Whether this is the latest assistant message
 * @param {function} props.onFlowAction - Callback with FlowEvent when user interacts
 * @param {string} [props.selectedValue] - For option_selector: which option was picked
 * @param {string} [props.submittedText] - For text_input_prompt: submitted text
 * @param {string} [props.actedAction] - For confirmation: which action was taken
 */
export function StructuredMessageRenderer({
  content,
  isLatest,
  onFlowAction,
  selectedValue,
  submittedText,
  actedAction,
}) {
  if (!content || !content.type || !content.payload) return null;

  const emitFlowEvent = (action, value) => {
    const event = createFlowEvent(content, content.flow_step ?? 0, action, value);
    onFlowAction(event);
  };

  switch (content.type) {
    case STRUCTURED_MESSAGE_TYPES.OPTION_SELECTOR:
      return (
        <OptionSelectorCard
          payload={content.payload}
          isLatest={isLatest}
          selectedValue={selectedValue}
          onSelect={(value) => emitFlowEvent("option_selected", value)}
        />
      );

    case STRUCTURED_MESSAGE_TYPES.TEXT_INPUT_PROMPT:
      return (
        <TextInputPromptCard
          payload={content.payload}
          isLatest={isLatest}
          submittedText={submittedText}
          onSubmit={(text) => emitFlowEvent("text_submitted", text)}
        />
      );

    case STRUCTURED_MESSAGE_TYPES.CONFIRMATION:
      return (
        <ConfirmationCard
          payload={content.payload}
          isLatest={isLatest}
          actedAction={actedAction}
          onAction={(action) => emitFlowEvent(action, action)}
        />
      );

    case STRUCTURED_MESSAGE_TYPES.INFO_CARD:
      return (
        <InfoCard
          payload={content.payload}
          isLatest={isLatest}
          onAction={(action) => emitFlowEvent(action, action)}
        />
      );

    default:
      return null;
  }
}
