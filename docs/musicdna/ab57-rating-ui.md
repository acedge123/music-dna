# AB-57 accuracy rating UI

The critic-first final reading and conversation pages did not expose the older profile feedback strip. Asking the owner to rate those screens could not complete the real-feedback acceptance step.

The completed interview now ends with an optional “How accurate is this reading?” section: Accurate / Mixed / Not accurate, followed by Save rating. No answer is preselected or submitted on opening. The original reading and each visible conversation revision have separate controls bound to the exact displayed saved version. No controls are added during song choices or to public shares.

Saving reuses the existing authenticated feedback function and atomic persistence boundary. A dedicated authenticated read checks ownership and the exact version before returning only rating metadata. Saved is displayed only after a matching durable row/operation is read back; reopening the reading restores it. The per-session/version operation ID stays stable across reloads so an uncertain response cannot create another vote. An interrupted save locks its choice and offers Retry this rating or Check saved rating. Failed reads are unavailable, never an unrated/healthy empty state.

Verification: focused ownership/version/readback/retry tests, full application tests, TypeScript/lint and Vercel production build. Local browser checks use clearly labelled development fixtures with no production data/model calls: explicit selection, saved confirmation/reload, separate revisions, uncertain response followed by persisted readback, and375px mobile layout. No accuracy rating was submitted for the owner and no live synthetic learning evidence was created. Live authenticated rating remains the owner’s action.

No migration, credential, rollout flag or hosted worker change is required. AB-57 stays open until the owner submits actual feedback and a completed saved EdgeBot draft is verified. CGPT-assisted QA song choices remain distinct from verified owner-selected preferences.
