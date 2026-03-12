-- rampup データベーススキーマ
-- Supabase SQL Editor に貼り付けて実行してください

-- ===== テーブル作成 =====

-- 組織
CREATE TABLE organizations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  plan                  text DEFAULT 'entry',
  subscription_status   text DEFAULT 'trial',
  trial_ends_at         timestamptz,
  contract_start_at     timestamptz,
  contract_end_at       timestamptz,
  created_at            timestamptz DEFAULT now()
);

-- 契約管理
CREATE TABLE contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations,
  plan            text NOT NULL,
  member_limit    int NOT NULL,
  billing_cycle   text DEFAULT 'annual',
  amount          int,
  status          text NOT NULL,
  started_at      timestamptz NOT NULL,
  ends_at         timestamptz,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 解約・プラン変更申請
CREATE TABLE contract_inquiries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations,
  type        text NOT NULL,
  message     text,
  status      text DEFAULT 'open',
  created_at  timestamptz DEFAULT now()
);

-- テナント初期セットアップ用トークン
CREATE TABLE setup_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text UNIQUE NOT NULL,
  admin_email  text NOT NULL,
  org_name     text,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- ユーザー
CREATE TABLE users (
  id          uuid PRIMARY KEY REFERENCES auth.users,
  org_id      uuid REFERENCES organizations,
  email       text NOT NULL,
  name        text,
  role        text CHECK (role IN ('admin','manager','member')),
  created_at  timestamptz DEFAULT now()
);

-- マネージャー・メンバー紐付け
CREATE TABLE manager_member_relationships (
  manager_id  uuid REFERENCES users,
  member_id   uuid REFERENCES users,
  PRIMARY KEY (manager_id, member_id)
);

-- 診断結果
CREATE TABLE diagnostic_results (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid REFERENCES users,
  scores                  jsonb,
  manual_text             text,
  shared_with_manager     boolean DEFAULT false,
  completed_at            timestamptz,
  created_at              timestamptz DEFAULT now()
);

-- 面談準備
CREATE TABLE meeting_preps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id      uuid REFERENCES users,
  member_id       uuid REFERENCES users,
  meeting_type    text CHECK (meeting_type IN ('goal','feedback','1on1')),
  manager_notes   text,
  ai_output       text,
  feedback        smallint CHECK (feedback IN (1, -1)),
  created_at      timestamptz DEFAULT now()
);

-- 通知ログ
CREATE TABLE notification_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid REFERENCES organizations,
  recipient_id uuid REFERENCES users,
  type         text NOT NULL,
  sent_at      timestamptz DEFAULT now()
);

-- ===== RLS 有効化 =====

ALTER TABLE organizations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_inquiries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_tokens               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_member_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_preps              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs          ENABLE ROW LEVEL SECURITY;

-- ===== RLS ポリシー =====

-- users: 自分のレコードは読める
CREATE POLICY "users: self read" ON users
  FOR SELECT USING (auth.uid() = id);

-- users: 同一組織のadmin/managerは全員読める
CREATE POLICY "users: org read" ON users
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- users: 自分のレコードは更新できる
CREATE POLICY "users: self update" ON users
  FOR UPDATE USING (auth.uid() = id);

-- diagnostic_results: 本人は読み書き可
CREATE POLICY "diagnostic: self" ON diagnostic_results
  FOR ALL USING (user_id = auth.uid());

-- diagnostic_results: 共有済みはマネージャーが読める
CREATE POLICY "diagnostic: manager read" ON diagnostic_results
  FOR SELECT USING (
    shared_with_manager = true
    AND user_id IN (
      SELECT member_id FROM manager_member_relationships
      WHERE manager_id = auth.uid()
    )
  );

-- meeting_preps: 自分が作成したものは読み書き可
CREATE POLICY "meeting_preps: manager self" ON meeting_preps
  FOR ALL USING (manager_id = auth.uid());

-- manager_member_relationships: 自分に関連するものは読める
CREATE POLICY "mmr: self read" ON manager_member_relationships
  FOR SELECT USING (
    manager_id = auth.uid() OR member_id = auth.uid()
  );

-- organizations: 同一組織メンバーは読める
CREATE POLICY "orgs: member read" ON organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- contract_inquiries: 同一組織のadminが読み書き可
CREATE POLICY "contract_inquiries: admin" ON contract_inquiries
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- setup_tokens: service_role のみアクセス（RLSで全拒否、サーバーサイドのみ）
CREATE POLICY "setup_tokens: deny all" ON setup_tokens
  FOR ALL USING (false);
