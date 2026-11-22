# Hebrew Vowel Recorder

Open the recorder at https://esemmelman.github.io/avery02/. Record and save the
pronunciation for each pair. Next moves to the next pair and plays its saved
sound. Tap the pair to hear it again. Tap a vowel in the left panel to play or
record that vowel on its own. Recordings are shared across devices and available
to anyone who opens the recorder.

GitHub Pages serves the recorder directly. The Supabase Edge Function in
`supabase/functions/avery02-pages` reads and saves the vowel and pair files in the
existing Storage bucket. The service credential stays in the function runtime.
The former Sites host redirects old bookmarks to GitHub Pages.
