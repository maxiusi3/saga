-- 通知系统相关表
-- 这个迁移创建通知系统所需的所有表

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'new_story',
    'new_comment', 
    'new_follow_up_question',
    'story_response',
    'project_invitation',
    'member_joined',
    'chapter_completed',
    'export_ready'
  )),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- 存储相关的数据，如story_id, project_id等
  action_url VARCHAR(500), -- 点击通知后跳转的URL
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 通知设置表
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL表示全局设置
  notification_type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, project_id, notification_type)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_project_id ON notification_settings(project_id);

-- 启用RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- 通知表的RLS策略
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- 允许系统创建通知

-- 通知设置表的RLS策略
CREATE POLICY "Users can view their own notification settings" ON notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own notification settings" ON notification_settings
  FOR ALL USING (auth.uid() = user_id);

-- 创建函数：自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为通知表添加自动更新触发器
CREATE TRIGGER update_notifications_updated_at 
  BEFORE UPDATE ON notifications 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at 
  BEFORE UPDATE ON notification_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 创建函数：发送通知
CREATE OR REPLACE FUNCTION send_notification(
  recipient_user_id UUID,
  sender_user_id UUID,
  notification_type VARCHAR(50),
  notification_title VARCHAR(255),
  notification_message TEXT,
  notification_data JSONB DEFAULT NULL,
  notification_action_url VARCHAR(500) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
  user_settings RECORD;
  should_send BOOLEAN := true;
BEGIN
  -- 检查用户的通知设置
  SELECT * INTO user_settings 
  FROM notification_settings 
  WHERE user_id = recipient_user_id 
    AND notification_type = send_notification.notification_type
    AND (project_id IS NULL OR project_id = (notification_data->>'project_id')::UUID)
  ORDER BY project_id NULLS LAST
  LIMIT 1;
  
  -- 如果用户禁用了此类型的通知，则不发送
  IF user_settings.id IS NOT NULL AND NOT user_settings.enabled THEN
    should_send := false;
  END IF;
  
  -- 发送通知
  IF should_send THEN
    INSERT INTO notifications (
      recipient_id,
      sender_id,
      type,
      title,
      message,
      data,
      action_url
    ) VALUES (
      recipient_user_id,
      sender_user_id,
      notification_type,
      notification_title,
      notification_message,
      notification_data,
      notification_action_url
    ) RETURNING id INTO notification_id;
  END IF;
  
  RETURN notification_id;
END;
$$;

-- 创建函数：批量标记通知为已读
CREATE OR REPLACE FUNCTION mark_notifications_as_read(
  user_id UUID,
  notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF notification_ids IS NULL THEN
    -- 标记所有未读通知为已读
    UPDATE notifications 
    SET is_read = true, read_at = NOW(), updated_at = NOW()
    WHERE recipient_id = user_id AND is_read = false;
  ELSE
    -- 标记指定的通知为已读
    UPDATE notifications 
    SET is_read = true, read_at = NOW(), updated_at = NOW()
    WHERE recipient_id = user_id 
      AND id = ANY(notification_ids) 
      AND is_read = false;
  END IF;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 创建函数：获取未读通知数量
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unread_count
  FROM notifications
  WHERE recipient_id = user_id AND is_read = false;
  
  RETURN COALESCE(unread_count, 0);
END;
$$;

-- 创建函数：清理旧通知（保留最近30天的通知）
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
