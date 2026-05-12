-- Step 19: optional visitor phone, captured when secretary creates an appointment.
-- Foreign-guest flow leaves this NULL (no local number to record).

ALTER TABLE appointments
  ADD visitor_phone NVARCHAR(40) NULL;
GO
