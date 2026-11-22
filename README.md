# Hebrew Vowel Recorder

Tap a vowel to play its saved recording. To add or replace a clip, record the sound,
preview it, then tap **Save recording**. Sign in with the same ChatGPT account on each
device to access your clips.

The Sites Worker authenticates each request and uses a dedicated private Supabase
Storage bucket, `avery02-vowel-recordings`. The Supabase Edge Function in
`supabase/functions/avery02-recordings` accepts only the recorder's server credential.
When deploying that function, replace `__RECORDINGS_TOKEN_SHA256__` with the SHA-256
digest of an independently generated 32-byte hex token. Configure the original token
as the Sites secret `SUPABASE_RECORDINGS_TOKEN` and the function endpoint as
`SUPABASE_RECORDINGS_URL`.

The existing Sites R2 binding lets the Worker copy older clips to Supabase when the
owner opens the recorder. The copy operation preserves any clip already in Supabase.

Run `npm run build` to package the frontend and Worker in `dist/`. GitHub Pages
opens the hosted recorder.
