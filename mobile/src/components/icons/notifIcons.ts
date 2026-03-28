import type { IconName } from "./iconMap";

/** Maps API notification `type` → semantic icon + tint for dashboard / inbox rows. */
export function getNotifIconMeta(
  type: string,
  colors: { success: string; danger: string; textMuted: string; moonstone: string; orange: string }
): { name: IconName; color: string } {
  const lc = colors;
  const map: Record<string, { name: IconName; color: string }> = {
    game_started: { name: "notifPlayCircle", color: lc.success },
    game_ended: { name: "notifStopCircle", color: lc.textMuted },
    settlement_generated: { name: "notifCalc", color: "#F59E0B" },
    settlement: { name: "notifCalc", color: "#F59E0B" },
    invite_accepted: { name: "notifPersonAdd", color: lc.success },
    wallet_received: { name: "notifWalletFill", color: lc.success },
    group_invite: { name: "notifPeopleFill", color: lc.orange },
    group_invite_request: { name: "notifPeopleFill", color: "#A855F7" },
    game_invite: { name: "notifGamePadFill", color: "#A855F7" },
    invite_declined: { name: "notifXCircle", color: lc.danger },
    buy_in: { name: "cashCta", color: lc.orange },
    buy_in_request: { name: "cashCta", color: lc.orange },
    buy_in_approved: { name: "notifCheckFill", color: lc.success },
    cash_out: { name: "notifTrending", color: lc.success },
    join_request: { name: "notifPersonAdd", color: "#3B82F6" },
    join_approved: { name: "notifCheckFill", color: lc.success },
    join_rejected: { name: "notifXCircle", color: lc.danger },
    payment_request: { name: "notifCardFill", color: "#3B82F6" },
    payment_received: { name: "notifCardFill", color: lc.success },
    reminder: { name: "notifAlarm", color: lc.moonstone },
    automation_disabled: { name: "notifGear", color: lc.danger },
    automation_error: { name: "notifGear", color: lc.danger },
    group_message: { name: "notifChatFill", color: "#3B82F6" },
    group_chat: { name: "notifChatFill", color: "#3B82F6" },
    feedback_update: { name: "notifMegaphone", color: "#A855F7" },
    issue_responded: { name: "notifMegaphone", color: "#A855F7" },
    post_game_survey: { name: "notifClipboard", color: "#F59E0B" },
    admin_transferred: { name: "notifShieldFill", color: lc.orange },
    invite_sent: { name: "notifMailFill", color: "#3B82F6" },
    chip_edit: { name: "notifPencil", color: lc.moonstone },
    withdrawal_requested: { name: "notifArrowDownCircle", color: "#F59E0B" },
  };
  return map[type] || { name: "pushNotifications", color: lc.moonstone };
}
