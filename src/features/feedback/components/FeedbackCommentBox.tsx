// Inline comment box at click point. Save to DB via createPin mutation.

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import { useFeedbackPinMutations } from "../hooks/useFeedbackPinMutations";
import type { TargetingResult } from "../types";
import { getCurrentRoute, getCurrentPageTitle } from "../lib/routeMatching";

const MAX_CHARS = 1000;

type Props = {
  target: TargetingResult;
  position: { x: number; y: number };
  onClose: () => void;
};

export function FeedbackCommentBox({ target, position, onClose }: Props) {
  // eslint-disable-next-line no-console
  console.log("[F4 DIAG] FeedbackCommentBox MOUNTED with target:", target, "position:", position);
  const { t } = useTranslation();
  const { createPin } = useFeedbackPinMutations();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = text.trim().length > 0 && !createPin.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await createPin.mutateAsync({
        page_route: getCurrentRoute(),
        page_title: getCurrentPageTitle(),
        feedback_id: target.feedback_id,
        selector_fallback: target.selector_fallback,
        x_percent: target.x_percent,
        y_percent: target.y_percent,
        viewport_width: target.viewport_width,
        element_html: target.element_html,
        comment_text: text.trim(),
      });
      toast.success(t("feedback.toast.pinCreated"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const BOX_WIDTH = 320;
  const BOX_HEIGHT = 200;
  const rawLeft = position.x - window.scrollX;
  const rawTop = position.y - window.scrollY + 16;
  const left = Math.max(16, Math.min(rawLeft, window.innerWidth - BOX_WIDTH - 16));
  const top = Math.max(16, Math.min(rawTop, window.innerHeight - BOX_HEIGHT - 16));

  return (
    <div
      data-feedback-ui="true"
      style={{
        position: "fixed",
        top,
        left,
        width: BOX_WIDTH,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-modal)",
        padding: 12,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          {t("feedback.commentBox.title")}
        </span>
        <button
          data-feedback-ui="true"
          type="button"
          onClick={onClose}
          aria-label={t("feedback.commentBox.cancel")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "var(--text-secondary)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <X size={16} />
        </button>
      </div>

      <textarea
        data-feedback-ui="true"
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
        placeholder={t("feedback.commentBox.placeholder")}
        rows={4}
        style={{
          width: "100%",
          padding: 8,
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)",
          resize: "none",
          fontSize: 14,
          fontFamily: "inherit",
          color: "var(--text-primary)",
          backgroundColor: "var(--bg-subtle)",
          boxSizing: "border-box",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSubmit();
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          {text.length}/{MAX_CHARS} · {t("feedback.commentBox.cmdEnter")}
        </span>
        <button
          data-feedback-ui="true"
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            backgroundColor: canSubmit ? "var(--action-primary)" : "var(--bg-disabled)",
            color: "var(--text-inverse)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <Send size={14} />
          {createPin.isPending
            ? t("feedback.commentBox.saving")
            : t("feedback.commentBox.save")}
        </button>
      </div>
    </div>
  );
}
