-- 创建存储用户旅行偏好的表
CREATE TABLE IF NOT EXISTS travel_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    location TEXT NOT NULL,
    days TEXT NOT NULL,
    travelers TEXT,
    budget TEXT,
    user_id UUID,
    -- 加密处理敏感信息，符合GDPR要求
    encrypted_data JSONB
);

-- 创建存储行程的表
CREATE TABLE IF NOT EXISTS itineraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    preference_id UUID REFERENCES travel_preferences(id) ON DELETE CASCADE,
    itinerary_data JSONB NOT NULL,
    destination TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    summary TEXT,
    is_ai_generated BOOLEAN DEFAULT TRUE,
    user_id UUID,
    -- 加密处理敏感信息，符合GDPR要求
    encrypted_data JSONB
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_itineraries_user_id ON itineraries(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_preferences_user_id ON travel_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_preference_id ON itineraries(preference_id);

-- RLS (Row Level Security) 策略，确保用户只能访问自己的数据
ALTER TABLE travel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

-- 为已认证用户创建 RLS 策略
CREATE POLICY "Users can only access their own travel preferences"
    ON travel_preferences
    FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Users can only access their own itineraries"
    ON itineraries
    FOR ALL
    USING (user_id = auth.uid());

-- 添加外键约束
ALTER TABLE itineraries
    ADD CONSTRAINT fk_itineraries_preference_id
    FOREIGN KEY (preference_id)
    REFERENCES travel_preferences(id)
    ON DELETE CASCADE; 