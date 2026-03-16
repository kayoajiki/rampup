-- 今期の期待（目標設定面談向け）を保存するカラム
ALTER TABLE meeting_preps
  ADD COLUMN IF NOT EXISTS manager_expectations text;

