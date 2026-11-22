# Hebrew Vowel Recorder

Open the recorder at https://esemmelman.github.io/avery02/. Use the same recorder
access code on each device to unlock the same private Supabase recordings. Tap a
vowel to play its saved sound, or record and save a replacement.

GitHub Pages serves `index.html` and `web/` directly. The Supabase Edge Function in
`supabase/functions/avery02-pages` authenticates requests using the SHA-256 digest
of the 32-byte hex access code, scoped to the recorder's private bucket.
Substitute the digest for `__ACCESS_CODE_SHA256__` at deployment.

The previous Sites address serves a retirement response. Its Worker was used
to transfer any legacy R2 recordings into Supabase during the cutover.
