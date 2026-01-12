-- Create table for admin-granted achievements (tournament wins etc)
CREATE TABLE public.admin_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT '🏆',
  rarity text NOT NULL DEFAULT 'legendary',
  place integer, -- 1, 2, 3 for tournament places
  granted_by uuid REFERENCES public.profiles(id),
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_achievements ENABLE ROW LEVEL SECURITY;

-- Anyone can view achievements
CREATE POLICY "Anyone can view admin achievements"
  ON public.admin_achievements
  FOR SELECT
  USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert admin achievements"
  ON public.admin_achievements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can delete
CREATE POLICY "Admins can delete admin achievements"
  ON public.admin_achievements
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create index for faster queries
CREATE INDEX idx_admin_achievements_user_id ON public.admin_achievements(user_id);