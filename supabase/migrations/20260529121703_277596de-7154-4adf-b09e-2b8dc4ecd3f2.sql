-- Replies for announcements
CREATE TABLE public.announcement_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcement_replies_ann ON public.announcement_replies(announcement_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_replies TO authenticated;
GRANT ALL ON public.announcement_replies TO service_role;

ALTER TABLE public.announcement_replies ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the parent announcement can see/reply
CREATE POLICY "ann_replies_select" ON public.announcement_replies
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id));

CREATE POLICY "ann_replies_insert" ON public.announcement_replies
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id));

CREATE POLICY "ann_replies_delete" ON public.announcement_replies
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR has_role(auth.uid(), 'diretoria'::app_role));