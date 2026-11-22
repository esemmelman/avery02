# Hebrew Vowel Recorder

Select a vowel, record its sound, and play the clip back before tapping **Save recording**.
Open the private recorder on each device with the same ChatGPT account to access your saved clips.

The frontend lives in `web/`. The Sites Worker serves the frontend and stores audio in the
private `BUCKET` binding, using the signed-in account ID to scope each recording. The GitHub
Pages entry opens the hosted recorder.

Run `npm run build` to package the frontend and Worker in `dist/`.
