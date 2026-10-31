# Import Study Buddy AI into Google AI Studio

This repository contains the existing Study Buddy AI application. Import the repository into Google AI Studio Build mode rather than creating a new app from scratch.

## Import the existing project

1. Open [Google AI Studio](https://aistudio.google.com/).
2. Open **Build** mode.
3. Open the **Add files (+)** menu beside the prompt box.
4. Choose **Import from GitHub**.
5. Select **martinmikemuza7-a11y/College-** and import the **main** branch.
6. Wait for the project to load, then open the preview and test the existing Study Buddy AI flows before publishing.

Google's current instructions for importing an existing GitHub project are in the [AI Studio Build mode documentation](https://ai.google.dev/gemini-api/docs/aistudio-build-mode).

## Gemini API secret

The server reads the Gemini API key from the environment variable `GEMINI_API_KEY`. In AI Studio, open **Settings → Secrets** and verify that `GEMINI_API_KEY` is available to the server runtime. AI Studio-created apps can have this key injected as a server-side secret. Never paste a real API key into client-side code or commit it to GitHub.

The repository includes `.env.example` as a variable-name reference only. It does not contain a usable API key.

## Before publishing for real students

- Test document upload and extraction using representative PDF, DOCX, PPTX, image, and text files.
- Test all three assessment modes: Actual Past Paper, Past-Paper Practice, and Notes-Based Practice.
- Confirm generated questions have natural wording, answers supported by course notes, and no repeated questions.
- Test authentication, saved courses, folders, question banks, and study progress with more than one session.

**Storage limitation:** the current repository persists application data in a local JSON file under `data/db.json`. A container filesystem on Cloud Run should not be treated as durable storage. Before using the published app for real students or relying on stored uploads, progress, and question banks, migrate persistence to a managed database such as Firestore or Cloud SQL.

Importing the code into AI Studio does not itself publish the app. When the preview and tests are satisfactory, use AI Studio's publish flow to deploy it to Cloud Run.
