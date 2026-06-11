# SoundPrint

SoundPrint helps Spotify users understand how their music taste changes over time by combining listening analytics, visualizations, and AI-generated taste summaries.

## Features

- Spotify OAuth login with PKCE
- Top tracks and top artists by time range
- Album covers and artist images from the Spotify API
- Backend-generated taste analytics with FastAPI
- Artist frequency chart
- Recent taste shift metric comparing short-term and all-time artists
- AI-generated taste summary using Gemini

## Tech Stack

- React
- TypeScript
- FastAPI
- Python
- Spotify Web API
- Gemini API

## Architecture

The frontend handles Spotify authentication, data fetching, and dashboard rendering.
The backend computes taste analytics and generates AI summaries from the analyzed listening profile.

## Current Analytics

- Unique artists across top tracks
- Most repeated artist
- Artist variety score
- Top artist overlap
- Artist frequency
- Recent taste shift

## Roadmap

- Personalized recommendation engine
- Recommendation explanations
- Taste similarity scoring
- Genre and artist clustering
- Expanded recent-vs-long-term taste comparison