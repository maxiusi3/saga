CREATE OR REPLACE FUNCTION get_stories_with_details(p_project_id UUID)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    title TEXT,
    project_id UUID,
    creator_id UUID,
    audio_url TEXT,
    transcript TEXT,
    prompt TEXT,
    summary TEXT,
    duration INTEGER,
    category VARCHAR(255),
    storyteller_name VARCHAR(255),
    storyteller_email VARCHAR(255),
    storyteller_avatar_url TEXT,
    latest_interaction_time TIMESTAMPTZ,
    comments_count BIGINT,
    follow_ups_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.created_at,
        s.updated_at,
        s.title,
        s.project_id,
        s.creator_id,
        s.audio_url,
        s.transcript,
        s.prompt,
        s.summary,
        COALESCE(s.duration, 0) AS duration,
        s.category,
        up.full_name AS storyteller_name,
        up.email AS storyteller_email,
        up.avatar_url AS storyteller_avatar_url,
        s.latest_interaction_time,
        (SELECT COUNT(*) FROM interactions i WHERE i.story_id = s.id AND i.type = 'comment') AS comments_count,
        (SELECT COUNT(*) FROM interactions i WHERE i.story_id = s.id AND i.type = 'follow-up') AS follow_ups_count
    FROM
        stories s
    LEFT JOIN
        user_profiles up ON s.creator_id = up.user_id
    WHERE
        s.project_id = p_project_id
    ORDER BY
        s.created_at DESC;
END;
$$ LANGUAGE plpgsql;