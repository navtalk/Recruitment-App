# NavTalk Recruitment App

AI-powered digital interviewer application using NavTalk's real-time digital human technology. Conducts professional job interviews with live video, speech-to-text transcription, and structured question flow.

## Getting Started

```bash
cd Recruitment-App
npm install
# Configure your NavTalk credentials (see Configuration section)
npm run dev
```

The dev server runs on <http://localhost:5173>.

### Configuration

Edit `src/config/navtalk.ts` and set environment variables for NavTalk connection:

**Environment Variables:**

| Key | Description |
| --- | --- |
| `VITE_NAVTALK_LICENSE` | NavTalk realtime license key. |
| `VITE_NAVTALK_CHARACTER_NAME` | Character name (e.g. `navtalk.Lauren`). Used as fallback if `VITE_NAVTALK_AVATAR_ID` is not set. |
| `VITE_NAVTALK_AVATAR_ID` | **(Optional, Recommended)** Avatar ID for precise lookup. **If set, takes priority over `VITE_NAVTALK_CHARACTER_NAME`**. Leave empty to use character name for avatar lookup. |
| `VITE_NAVTALK_VOICE` | Voice preset (e.g. `sage`, `marin`, `cedar`). |
| `VITE_NAVTALK_PROMPT` | Optional custom prompt for the interviewer. |
| `VITE_NAVTALK_BASE_URL` | NavTalk WebSocket endpoint URL. |
| `VITE_NAVTALK_LANGUAGE` | Interview language (`en` or `zh`). |

**Default Configuration:**

The app uses default values defined in `src/config/navtalk.ts`. You can override them using environment variables or modify the defaults directly.

> **Connection Priority:** The system will use `avatarId` if provided, otherwise falls back to `characterName`. This allows precise avatar selection while maintaining backward compatibility.

> The browser will request microphone and camera permissions the first time you start an interview session.

## Project Structure

- `src/config/navtalk.ts` – NavTalk configuration and language presets
- `src/services/navtalkSession.ts` – WebSocket + WebRTC session management
- `src/components/DigitalHumanModal.vue` – Digital interviewer UI component
- `src/views` – Application views
- `src/types` – TypeScript type definitions

## Features

- Real-time video interview with AI interviewer
- Multi-language support (English/Chinese)
- Speech-to-text transcription
- Structured question flow (fixed or AI-generated)
- Interview session recording and transcript export
- Professional interview experience with natural conversation

## Usage

1. Set up job roles with interview questions
2. Start interview session
3. The AI interviewer (Aoibheann) will:
   - Introduce herself
   - Ask questions one at a time
   - Acknowledge responses
   - Maintain professional tone throughout
   - Conclude with closing remarks

## Building for Production

```bash
npm run build    # type-checks and builds
npm run preview  # preview production build locally
```
