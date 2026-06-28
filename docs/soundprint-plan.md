# SoundPrint Plan

## One-Sentence Promise
SoundPrint connects to a user's Spotify account, analyzes their listening patterns, and generates an AI-powered music taste profile with personalized recommendations.

## Why This Project

I want to build a project that combines music, data science, statistics, AI, and full-stack software engineering.

## MVP Features
- Connect Spotify account
- Fetch top tracks/artists
- Analyze listening patterns
- Visualize music taste
- Recommend songs or artists based on similarity
- Generate AI-powered explanations of the user's taste and recommendations

## Stretch Features
- Taste clusters or taste map
- Playlist generation
- Compare two users' music taste
- Track changes in taste over time
- Deploy publicly

## Tech Stack
- React + TypeScript
- FastAPI
- Python
- Spotify Web API
- Recharts
- Gemini or OpenAI API

## Possible Future Tech
- Pandas
- scikit-learn
- Plotly

## Questions To Research
- How does Spotify OAuth work?
- What data can I realistically access from Spotify?
- Can I access audio features for tracks?
- What recommendation method should I start with?
- How should the frontend and backend communicate?

## Research

Detailed research notes are in `research-notes.md`

## MVP Definition
The first complete version of SoundPrint is done when a user can connect their Spotify account, view an analysis of their top tracks/artists, see visualizations of their music taste through graphs or maps, receive similarity-based recommendations, and get an AI-powered explanation grounded in their listening data.

## First Build Milestones

### 1. Project Setup
- [x] Create React frontend using TypeScript
- [x] Create FastAPI backend using Python
- [x] Confirm frontend can call backend and receive JSON

### 2. Spotify Developer Setup
- [x] Create Spotify Developer app
- [x] Add local redirect URI (Uniform Resource Indicator)
- [x] Store Spotify Client ID safely
- [x] Understand which OAuth values belong in frontend vs backend

- Created a Spotify Developer app for SoundPrint
- Redirect URI: `http://127.0.0.1:5173/callback`
- Selected API: Web API
- SoundPrint uses PKCE, so Client Secret should not be exposed in frontend code

## Recommendation Quality Note
- All-time recommendations tend to repeat similar artists, but they feel relevant rather than random.
- This may be because all-time listening is more stable and does not change as often.
- A future improvement could label recommendations as close matches, bridge picks, or discovery picks.

## Recommendation Modes Idea

Possible future labels:

- Close match: artists similar to the user's strongest long-term signals
- Bridge pick: artists that connect recent listening with long-term listening
- Discovery pick: artists that are less obvious but still connected to the user's taste profile
