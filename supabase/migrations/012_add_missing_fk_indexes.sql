-- Kvitt Performance Remediation: Add missing foreign key indexes
-- Migration: 012_add_missing_fk_indexes
-- Without these, DELETE/UPDATE on the referenced table requires a sequential scan
-- of the FK table, which gets expensive as data grows.

-- debt_payments
CREATE INDEX IF NOT EXISTS idx_debt_payments_from_user_id
  ON public.debt_payments (from_user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_to_user_id
  ON public.debt_payments (to_user_id);

-- feedback_surveys
CREATE INDEX IF NOT EXISTS idx_feedback_surveys_group_id
  ON public.feedback_surveys (group_id);
CREATE INDEX IF NOT EXISTS idx_feedback_surveys_user_id
  ON public.feedback_surveys (user_id);

-- group_invites
CREATE INDEX IF NOT EXISTS idx_group_invites_invited_by
  ON public.group_invites (invited_by);

-- host_updates
CREATE INDEX IF NOT EXISTS idx_host_updates_host_id
  ON public.host_updates (host_id);

-- pay_net_plans
CREATE INDEX IF NOT EXISTS idx_pay_net_plans_group_id
  ON public.pay_net_plans (group_id);
CREATE INDEX IF NOT EXISTS idx_pay_net_plans_user_id
  ON public.pay_net_plans (user_id);

-- payment_reminders_log
CREATE INDEX IF NOT EXISTS idx_payment_reminders_log_user_id
  ON public.payment_reminders_log (user_id);

-- user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON public.user_sessions (user_id);

-- wallet_audit
CREATE INDEX IF NOT EXISTS idx_wallet_audit_wallet_id
  ON public.wallet_audit (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_audit_user_id
  ON public.wallet_audit (user_id);

-- wallet_deposits
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_user_id
  ON public.wallet_deposits (user_id);
