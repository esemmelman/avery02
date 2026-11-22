# Hebrew Vowel Recorder

Open the recorder at https://esemmelman.github.io/avery02/. Previous and Next
move between pairs. Tap the displayed pair or a vowel in the left panel to
hear its saved sound. The recording controls
are currently hidden. Saved sounds are shared across devices.

GitHub Pages serves the recorder directly. The Supabase Edge Function in
`supabase/functions/avery02-pages` reads and saves the vowel and pair files in the
existing Storage bucket. The service credential stays in the function runtime.
The former Sites host redirects old bookmarks to GitHub Pages.
