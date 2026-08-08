# ILAW Teacher Suite V5 — Online

This is the online-ready version of the ILAW Teacher Suite.

## What changed

- The Gemini API key is no longer entered in the browser.
- AI requests go through `/api/gemini`.
- The server reads `GEMINI_API_KEY` from an environment variable.
- The existing lesson-plan generator, improvement tools, session regeneration, and Friday Reflection remain in the app.
- The Friday Reflection uses its dedicated JSON schema.

## Deploy on Vercel

1. Create a GitHub repository and upload all files in this folder.
2. Import the repository into Vercel.
3. In Vercel Project Settings → Environment Variables, add:
   - Name: `GEMINI_API_KEY`
   - Value: your Gemini API key
4. Redeploy.
5. Open the generated website URL.
6. Click **Test API** to verify the server connection.

Do not put the Gemini API key inside `index.html` or commit it to GitHub.

## Local development

Use a Vercel-compatible local environment if you want to test `/api/gemini`. Opening `index.html` directly with `file://` will not provide the server API route.
