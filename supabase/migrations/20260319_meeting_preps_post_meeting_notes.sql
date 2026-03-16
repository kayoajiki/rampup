-- 面談後メモ（議事録等）を保存。次回の「前回の1on1メモ」に自動引き継ぎ
ALTER TABLE meeting_preps
  ADD COLUMN IF NOT EXISTS post_meeting_notes text;
