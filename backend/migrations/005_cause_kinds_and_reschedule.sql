-- Three independent cause taxonomies in one table:
--   kind='visit'      — what the visitor is here for (existing causes; backfilled)
--   kind='reject'     — why the boss declined (chosen on reject)
--   kind='reschedule' — why the boss moved the date (optional on reschedule)
-- Reject endpoint also persists rejection_cause_id alongside the existing
-- free-text rejection_reason, mirroring the cause_id + custom_cause pair.
-- Reschedule introduces a new history action; the CHECK on
-- appointment_history.action must be widened to allow it. Reschedule details
-- (oldDate, newDate, causeId, reason) live in appointment_history.note as JSON.

ALTER TABLE causes
  ADD kind NVARCHAR(20) NOT NULL CONSTRAINT df_causes_kind DEFAULT 'visit';
GO

ALTER TABLE causes
  ADD CONSTRAINT ck_causes_kind CHECK (kind IN ('visit','reject','reschedule'));
GO

CREATE INDEX ix_causes_kind ON causes(kind);
GO

ALTER TABLE appointments
  ADD rejection_cause_id NVARCHAR(50) NULL
      CONSTRAINT fk_appt_rejection_cause FOREIGN KEY REFERENCES causes(id);
GO

ALTER TABLE appointment_history DROP CONSTRAINT ck_action;
GO

ALTER TABLE appointment_history
  ADD CONSTRAINT ck_action CHECK
    (action IN ('create','approve','reject','invite','complete','reschedule'));
GO

-- Seed a couple of system reject + reschedule causes so the dropdowns are
-- never empty out of the box. Staff can add more in Settings.
INSERT INTO causes (id, label_ru, label_tk, is_system, kind) VALUES
  ('reject_busy',      N'Босс занят',          N'Başlyk meşgul',           1, 'reject'),
  ('reject_wrong_boss',N'Не к этому боссу',    N'Bu başlyga däl',          1, 'reject'),
  ('reject_other',     N'Другое',              N'Beýleki',                 1, 'reject'),
  ('resched_busy',     N'Босс занят в этот день', N'Şol gün başlyk meşgul', 1, 'reschedule'),
  ('resched_other',    N'Другое',              N'Beýleki',                 1, 'reschedule');
GO
