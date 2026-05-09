-- The audit log is the product. UPDATE/DELETE on this table is forbidden at the schema level.
-- If a future schema change requires modifying this trigger, drop+recreate in the same migration.

CREATE TRIGGER tr_history_no_modify
ON appointment_history
INSTEAD OF UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  THROW 51000, 'appointment_history is append-only', 1;
END;
GO
