-- Create privacy agreements table
CREATE TABLE IF NOT EXISTS privacy_agreements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  agreed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_privacy_agreements_user_id ON privacy_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_privacy_agreements_version ON privacy_agreements(version);
CREATE INDEX IF NOT EXISTS idx_privacy_agreements_agreed_at ON privacy_agreements(agreed_at);

-- Create unique constraint to prevent duplicate agreements for same user and version
CREATE UNIQUE INDEX IF NOT EXISTS idx_privacy_agreements_user_version 
ON privacy_agreements(user_id, version);

-- Enable RLS
ALTER TABLE privacy_agreements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own privacy agreements" ON privacy_agreements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own privacy agreements" ON privacy_agreements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_privacy_agreements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER privacy_agreements_updated_at
  BEFORE UPDATE ON privacy_agreements
  FOR EACH ROW
  EXECUTE FUNCTION update_privacy_agreements_updated_at();

-- Add comment to table
COMMENT ON TABLE privacy_agreements IS 'Records user agreements to privacy policy versions';
COMMENT ON COLUMN privacy_agreements.version IS 'Version of privacy policy agreed to';
COMMENT ON COLUMN privacy_agreements.agreed_at IS 'Timestamp when user agreed to privacy policy';
COMMENT ON COLUMN privacy_agreements.ip_address IS 'IP address of user when they agreed (optional)';
COMMENT ON COLUMN privacy_agreements.user_agent IS 'User agent string when they agreed (optional)';
