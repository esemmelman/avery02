# Hebrew Vowel Recorder

Open the recorder at https://esemmelman.github.io/avery02/. Next moves to the
next pair and plays its saved sound. Tap the pair to hear it again, or tap a
vowel in the left panel to hear that vowel on its own. The recording controls
are currently hidden. Saved sounds are shared across devices.

GitHub Pages serves the recorder directly. The Supabase Edge Function in
`supabase/functions/avery02-pages` reads and saves the vowel and pair files in the
existing Storage bucket. The service credential stays in the function runtime.
The former Sites host redirects old bookmarks to GitHub Pages.
