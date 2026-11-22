# Hebrew Vowel Recorder

Open the recorder at https://esemmelman.github.io/avery02/. Tap a vowel to play its
saved sound, or record and save a replacement. Recordings are shared across
devices and available to anyone who opens the recorder.

GitHub Pages serves the recorder directly. The Supabase Edge Function in
`supabase/functions/avery02-pages` reads and saves the thirteen vowel files in the
existing Storage bucket. The service credential stays in the function runtime.
The former Sites host redirects old bookmarks to GitHub Pages.
