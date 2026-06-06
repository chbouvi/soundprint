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
- Pandas
- scikit-learn
- Plotly or Recharts
- Gemini or OpenAI API

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
- [ ] Create Spotify Developer app
- [ ] Add local redirect URI (Uniform Resource Indicator)
- [ ] Store Spotify Client ID safely
- [ ] Understand which OAuth values belong in frontend vs backend