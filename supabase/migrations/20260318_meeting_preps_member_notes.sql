-- meeting_prepsにカラム追加
ALTER TABLE meeting_preps
  ADD COLUMN IF NOT EXISTS previous_notes  text,
  ADD COLUMN IF NOT EXISTS recent_behaviors text;

-- マネージャーの日常メモテーブル
CREATE TABLE IF NOT EXISTS member_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  uuid REFERENCES users,
  member_id   uuid REFERENCES users,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE member_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_notes: manager self" ON member_notes
  FOR ALL USING (manager_id = auth.uid());

-- diagnoses テーブルにshared_with_managerがなければ追加
ALTER TABLE diagnoses
  ADD COLUMN IF NOT EXISTS shared_with_manager boolean DEFAULT false;
