DROP POLICY "Approved archetype profiles are readable" ON public.archetype_profiles;
DROP POLICY "Admins update archetype profiles" ON public.archetype_profiles;
DROP POLICY "Admins write archetype profiles" ON public.archetype_profiles;
CREATE POLICY "Approved archetype profiles are readable" ON public.archetype_profiles FOR SELECT TO authenticated
  USING (coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false AND (status = 'approved' OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admins write archetype profiles" ON public.archetype_profiles FOR INSERT TO authenticated
  WITH CHECK (coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update archetype profiles" ON public.archetype_profiles FOR UPDATE TO authenticated
  USING (coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false AND public.has_role(auth.uid(), 'admin'));
DROP POLICY "Approved song explanations are readable" ON public.song_trait_explanations;
DROP POLICY "Admins write song explanations" ON public.song_trait_explanations;
DROP POLICY "Admins update song explanations" ON public.song_trait_explanations;
CREATE POLICY "Approved song explanations are readable" ON public.song_trait_explanations FOR SELECT TO authenticated
  USING (coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false AND (status = 'approved' OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admins write song explanations" ON public.song_trait_explanations FOR INSERT TO authenticated
  WITH CHECK (coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update song explanations" ON public.song_trait_explanations FOR UPDATE TO authenticated
  USING (coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false AND public.has_role(auth.uid(), 'admin'));