# SoundPrint

SoundPrint is a Spotify analytics app that helps users understand their music taste through listening metrics, taste timelines, AI summaries, and artist recommendations.

## Screenshots

### Dashboard Overview
![Dashboard overview](docs/images/dashboard-overview.png)

### AI Taste Analysis
![AI taste analysis](docs/images/ai-taste-analysis.png)

### Recommended Artists
![Recommended artists](docs/images/recommended-artists.png)

## Demo Flow

1. Connect Spotify to load listening data.
2. Select a time range for top tracks and artists.
3. Review taste metrics, artist frequency, and the taste timeline.
4. Read the AI-generated taste summary and sound profile breakdown.
5. Explore recommended artists with fit scores, signal tags, and Spotify links.

## Features

- Spotify OAuth login with PKCE
- Top tracks and top artists by time range
- Album covers and artist images from the Spotify API
- Backend-generated taste analytics with FastAPI
- Artist frequency chart
- Recent taste shift metric comparing short-term and all-time artists
- Taste timeline comparing short-term, six-month, and all-time artists
- AI-generated taste summary using Gemini
- Gemini-generated recommended artists based on listening profile signals
- Backend cleanup that removes duplicate recommendations and already-known artists
- Recommendation signal tags explaining why each artist fits
- Recommendation type labels showing whether an artist is a close match, bridge pick, or discovery pick
- Direct Spotify artist links for recommended artists, with search fallback when no exact match is found
- Recommendation fit scores based on cleaned signal tags and listening profile metrics
- Spotify artist images on recommended artist cards when an exact artist match is found
- Clickable recommendation fit scores with explanations
- AI-generated sound profile breakdown with reusable style tags counted from the user's listening patterns
- Responsive dashboard layout for desktop and narrow screens

## Recommendation System

SoundPrint recommends artists using the user's top artists, top tracks, repeated artists, artist variety, top artist overlap, recent taste shift, and sound profile tags. Gemini generates possible recommendations, but the backend checks the results before they are shown in the app.

The backend removes duplicate recommendations, filters out artists already in the user's top artists or recommendation seeds, requires each result to have a name and reason, cleans up signal tags, and limits the list to four artists.

The frontend then searches Spotify for each recommended artist. If it finds an exact artist match, SoundPrint shows the artist image and links directly to the artist's Spotify page. If not, it falls back to a Spotify search link.

Each recommendation also gets a fit score. The score starts from a base value and increases when the recommendation has stronger matching signals.

SoundPrint also labels each recommendation as a close match, bridge pick, or discovery pick so the user can tell what kind of suggestion it is.

## Tech Stack

- React
- TypeScript
- FastAPI
- Python
- Recharts
- Spotify Web API
- Gemini API

## Architecture

The frontend handles Spotify authentication, Spotify data fetching, dashboard rendering, loading/error states, and recommendation display.

The backend computes listening analytics, builds prompts from structured taste signals, generates AI summaries and recommendations with Gemini, and validates AI recommendation output before sending it back to the frontend.

See [docs/architecture.md](docs/architecture.md) for a more detailed data flow.

## Running Locally

Run the backend and frontend in separate terminals.

### Backend

```bash
cd backend
python3 -m uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Create a `backend/.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Current Analytics

- Unique artists across top tracks
- Most repeated artist
- Artist variety score
- Top artist overlap
- Artist frequency
- Recent taste shift
- Taste timeline with new, bridge, and consistent artists
- Recommendation seeds
- Recommendation signal tags
- Sound profile tag frequency chart

## Roadmap

- Improve recommendation explanations using more of the user's listening patterns
- Add more visualizations for how taste changes over time
- Add deeper explanations for why artists move between recent, bridge, and consistent categories
- Explore taste groups or clusters based on listening patterns
- Deploy the app
- Add a short demo video/GIF showing the full app
