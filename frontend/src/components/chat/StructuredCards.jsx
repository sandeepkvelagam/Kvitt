import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, Info, AlertTriangle, XCircle } from "lucide-react";

// ─── Option Selector Card ─────────────────────────────────────────

export function OptionSelectorCard({ payload, isLatest, onSelect, selectedValue }) {
  const isInteractive = isLatest && !selectedValue;

  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-3 space-y-2">
      <p className="text-sm font-medium">{payload.prompt}</p>
      <div className="space-y-1.5">
        {payload.options.map((option) => {
          const isSelected = selectedValue === option.value;
          const isDimmed = !!selectedValue && !isSelected;
          return (
            <button
              key={option.value}
              onClick={() => isInteractive && onSelect(option.value)}
              disabled={!isInteractive}
              className={cn(
                "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-sm",
                isSelected
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border/50 bg-muted/30 hover:bg-muted/60",
                isDimmed && "opacity-40",
                !isInteractive && !isSelected && "cursor-default"
              )}
            >
              {option.icon && <span className="text-base">{option.icon}</span>}
              <div className="flex-1 min-w-0">
                <span className={cn("block", isSelected && "font-semibold")}>
                  {option.label}
                </span>
                {option.description && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </span>
                )}
              </div>
              {isSelected && <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Text Input Prompt Card ────────────────────────────────────────

const PII_PATTERN = /(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b)/;

export function TextInputPromptCard({ payload, isLatest, onSubmit, submittedText }) {
  const [text, setText] = useState("");
  const minLen = payload.min_length || 0;
  const maxLen = payload.max_length || 1000;
  const isEditable = isLatest && !submittedText;
  const hasPII = PII_PATTERN.test(text);
  const canSubmit = text.length >= minLen && text.length <= maxLen;

  if (!isEditable) {
    return (
      <div className="rounded-xl border border-border/50 bg-background/50 p-3 space-y-2">
        <p className="text-sm font-medium">{payload.prompt}</p>
        <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm text-muted-foreground">
          {submittedText || "..."}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-3 space-y-2">
      <p className="text-sm font-medium">{payload.prompt}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={payload.placeholder || "Type here..."}
        maxLength={maxLen}
        rows={3}
        className={cn(
          "w-full px-3 py-2 rounded-lg bg-muted/30 border text-sm resize-none focus:outline-none focus:ring-1",
          text.length > 0
            ? "border-amber-500/60 focus:ring-amber-500/40"
            : "border-border/50 focus:ring-border"
        )}
      />
      <div className="flex items-center justify-between text-xs">
        <span className={cn(text.length < minLen ? "text-amber-500" : "text-muted-foreground")}>
          {text.length}/{maxLen}
          {text.length < minLen ? ` (min ${minLen})` : ""}
        </span>
        {hasPII && (
          <span className="text-amber-500">Avoid sharing personal info</span>
        )}
      </div>
      <button
        onClick={() => canSubmit && onSubmit(text)}
        disabled={!canSubmit}
        className={cn(
          "w-full py-2 rounded-lg text-sm font-medium transition-colors",
          canSubmit
            ? "bg-violet-600 text-white hover:bg-violet-700"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {payload.submit_label || "Submit"}
      </button>
    </div>
  );
}

// ─── Confirmation Card ─────────────────────────────────────────────

const VARIANT_CONFIG = {
  success: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", ring: "ring-green-500/30" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", ring: "ring-blue-500/30" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", ring: "ring-red-500/30" },
};

export function ConfirmationCard({ payload, isLatest, onAction, actedAction }) {
  const config = VARIANT_CONFIG[payload.variant] || VARIANT_CONFIG.info;
  const Icon = config.icon;
  const showActions = isLatest && !actedAction && payload.actions?.length > 0;

  return (
    <div className={cn("rounded-xl border border-border/50 p-3 space-y-2 ring-1", config.bg, config.ring)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className={cn("w-5 h-5", config.color)} />
        <span className="text-sm font-semibold">{payload.title}</span>
      </div>

      {/* Message */}
      <p className="text-sm text-muted-foreground">{payload.message}</p>

      {/* Detail rows */}
      {payload.details?.length > 0 && (
        <div className="border-t border-border/50 pt-2 space-y-1">
          {payload.details.map((row, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {showActions && (
        <div className="flex gap-2 pt-1">
          {payload.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction(action.action)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                action.variant === "primary"
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : action.variant === "secondary"
                  ? "bg-muted hover:bg-muted/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Info Card ──────────────────────────────────────────────────────

export function InfoCard({ payload, isLatest, onAction }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-3 space-y-2">
      {/* Title row */}
      <div className="flex items-center gap-2">
        {payload.icon && <span className="text-amber-500 text-base">{payload.icon}</span>}
        <span className="text-sm font-semibold">{payload.title}</span>
      </div>

      {/* Body */}
      <p className="text-sm text-muted-foreground">{payload.body}</p>

      {/* Footer */}
      {payload.footer && (
        <p className="text-xs text-muted-foreground/70">{payload.footer}</p>
      )}

      {/* Actions */}
      {payload.actions?.length > 0 && isLatest && (
        <div className="flex gap-2 pt-1">
          {payload.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction?.(action.action)}
              className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
