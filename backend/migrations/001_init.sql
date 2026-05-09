-- Step 1: core schema. NVARCHAR everywhere for Cyrillic + Turkmen Latin diacritics.
-- All timestamps are UTC via SYSUTCDATETIME(); visit_date is a plain DATE in local Ashgabat time.

CREATE TABLE users (
  id              NVARCHAR(50)  NOT NULL PRIMARY KEY,
  display_name    NVARCHAR(200) NOT NULL,
  username        NVARCHAR(50)  NOT NULL,
  password_hash   NVARCHAR(200) NOT NULL,
  role            NVARCHAR(20)  NOT NULL,
  created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at      DATETIME2     NULL,
  CONSTRAINT ck_users_role CHECK (role IN
    ('secretary','assistant1','assistant2','assistant3',
     'boss1','boss2','boss3'))
);
GO

CREATE UNIQUE INDEX ux_users_username
  ON users(username) WHERE deleted_at IS NULL;
GO

CREATE INDEX ix_users_role
  ON users(role) WHERE deleted_at IS NULL;
GO

CREATE TABLE causes (
  id          NVARCHAR(50)  NOT NULL PRIMARY KEY,
  label_ru    NVARCHAR(200) NOT NULL,
  label_tk    NVARCHAR(200) NOT NULL,
  is_system   BIT           NOT NULL DEFAULT 0,
  created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE appointments (
  id                  INT           IDENTITY(1,1) PRIMARY KEY,
  visitor_type        NVARCHAR(20)  NOT NULL,
  employee_id         INT           NULL,
  visitor_first_name  NVARCHAR(100) NULL,
  visitor_last_name   NVARCHAR(100) NULL,
  visitor_company     NVARCHAR(200) NULL,
  boss_id             NVARCHAR(20)  NOT NULL,
  cause_id            NVARCHAR(50)  NOT NULL,
  custom_cause        NVARCHAR(500) NULL,
  urgent              BIT           NOT NULL DEFAULT 0,
  visit_date          DATE          NOT NULL,
  status              NVARCHAR(20)  NOT NULL,
  rejection_reason    NVARCHAR(500) NULL,
  created_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_appt_cause FOREIGN KEY (cause_id) REFERENCES causes(id),
  CONSTRAINT ck_visitor_type CHECK (visitor_type IN ('employee','guest','foreign')),
  CONSTRAINT ck_boss CHECK (boss_id IN ('boss1','boss2','boss3')),
  CONSTRAINT ck_status CHECK (status IN ('pending','approved','rejected','invited','completed'))
);
GO

CREATE INDEX ix_appt_date_status ON appointments(visit_date, status);
GO
CREATE INDEX ix_appt_boss        ON appointments(boss_id, visit_date);
GO
CREATE INDEX ix_appt_lastname    ON appointments(visitor_last_name);
GO

CREATE TABLE appointment_history (
  id              BIGINT        IDENTITY(1,1) PRIMARY KEY,
  appointment_id  INT           NOT NULL,
  action          NVARCHAR(20)  NOT NULL,
  user_id         NVARCHAR(50)  NOT NULL,
  at              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  note            NVARCHAR(500) NULL,
  CONSTRAINT fk_hist_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_hist_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT ck_action CHECK (action IN ('create','approve','reject','invite','complete'))
);
GO

CREATE INDEX ix_hist_appt ON appointment_history(appointment_id, at);
GO
CREATE INDEX ix_hist_user ON appointment_history(user_id, at);
GO
