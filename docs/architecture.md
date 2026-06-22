# SoundPrint Architecture

## Frontend Data Flow

- The user connects their Spotify account through OAuth PKCE.
- The frontend stores the Spotify access token after login for later use.
- React fetches the user's top tracks and top artists for the selected time range.
- The frontend sends selected listening data to the backend for more analysis.
- Backend responses are saved in React state and rendered as dashboard metrics, charts, summaries, and recommendations.
- Changing the time range resets the entire dashboard and sends new Spotify/backend requests.


## Backend Endpoints

- `/api/analyze-taste` receives top track artist data and returns taste metrics.
- `/api/taste-summary` receives the user's profile metrics and returns an AI-generated taste summary plus counted sound profile tags.
- `/api/recommend-artists` receives the user's profile metrics and returns validated artist recommendations with reasons, signals, and fit scores.

## Taste Analytics

- Artist frequency counts how often each artist appears across the user's top tracks.
- Artist variety measures how many unique artists appear across the user's top tracks.
- Top artist overlap calculates how many top artists also appear in the user's top tracks.
- The most repeated artist highlights which artist appears most often in the user's top tracks.
- Recent taste shift compares short-term artists against long-term artists to estimate how much their listening has changed.
- Sound profile tags summarize style patterns detected from the user's listening data.

## Sound Profile Breakdown

- Gemini returns structured JSON with a taste summary and style tags.
- The backend parses the JSON response and counts repeated tags across the returned sound profile items.
- The frontend renders the most common style tags as a Recharts bar chart.
- If Gemini output cannot be parsed, the backend falls back to default sound profile tags instead of breaking the dashboard.

## Recommendation System

- The frontend builds recommendation seeds from overlapping artists, repeated artists, and top artists.
- The backend builds a Gemini prompt using top artists, top tracks, recommendation seeds, artist frequency, taste shift, sound profile tags, and other profile metrics.
- Gemini returns recommended artists with reasons and signal tags.
- The backend validates the AI-generated recommendations by filtering out artists already present in the user's top artists or recommendation seeds, removing duplicates, requiring valid names and reasons, cleaning up signal tags, and limiting the results to four recommendations.
- Each recommendation receives a fit score based on the cleaned signal tags and profile metrics.
- Score factors are returned so the frontend can explain why each recommended artist received its fit score.

## Spotify Artist Matching

- After recommendations are returned, the frontend searches Spotify for each recommended artist name.
- Spotify search results are checked for an exact artist name match before SoundPrint trusts the result.
- When an exact match is found, SoundPrint adds the artist's exact Spotify page URL and image to the recommendation card.
- If no exact match is found, the button falls back to a Spotify search link for the artist rather than an exact page URL.

## AI and Fallback Behavior

- Gemini is used for taste summaries, sound profile tags, and recommended artist generation.
- If the Gemini API key is missing or the Gemini request fails, the backend falls back to a default taste summary and returns it instead of breaking the dashboard.
- Recommendation output is parsed as JSON before being used by the app.
- If Gemini returns invalid recommendation data, the backend returns an empty recommendation list rather than unsafe or broken results.
- Spotify artist matching also has a fallback if an exact match is not found, with the frontend using a Spotify search link.