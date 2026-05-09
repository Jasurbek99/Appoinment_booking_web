-- System causes — referenced by appointments.cause_id, cannot be deleted.

INSERT INTO causes (id, label_ru, label_tk, is_system) VALUES
  ('work',     N'По работе',         N'Iş boýunça',     1),
  ('personal', N'По своим причинам', N'Şahsy sebäpler', 1),
  ('other',    N'Другое',            N'Beýleki',        1);
GO
