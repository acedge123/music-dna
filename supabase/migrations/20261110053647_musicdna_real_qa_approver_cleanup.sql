-- Revoking/deleting the approving operator must stop their tester consents, not
-- prevent account deletion. Consent deletion uses the existing withdrawal hook.
ALTER TABLE public.musicdna_real_qa_consents DROP CONSTRAINT musicdna_real_qa_consents_approved_by_fkey;
ALTER TABLE public.musicdna_real_qa_consents ADD CONSTRAINT musicdna_real_qa_consents_approved_by_fkey
 FOREIGN KEY(approved_by) REFERENCES auth.users(id) ON DELETE CASCADE;
