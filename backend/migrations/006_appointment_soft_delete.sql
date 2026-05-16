-- Soft-delete for appointments. Secretaries/assistants can delete a 'pending'
-- entry they created by mistake; the row stays in the database so the
-- appointment_history rows that reference it keep resolving, and an audit
-- entry is written for the deletion itself.
--
-- The audit-log invariant (append-only) is preserved — we add a new history
-- action 'delete' rather than removing any history rows.

ALTER TABLE appointments
  ADD deleted_at         DATETIME2     NULL,
      deleted_by_user_id NVARCHAR(50)  NULL
        CONSTRAINT fk_appt_deleted_by FOREIGN KEY REFERENCES users(id);
GO

CREATE INDEX ix_appt_deleted_at ON appointments(deleted_at);
GO

ALTER TABLE appointment_history DROP CONSTRAINT ck_action;
GO

ALTER TABLE appointment_history
  ADD CONSTRAINT ck_action CHECK
    (action IN ('create','approve','reject','invite','complete','reschedule','delete'));
GO
