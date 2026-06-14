import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/api/health")
def health_check():
    return {"message": "SoundPrint backend is running"}

class TasteAnalysisRequest(BaseModel):
    top_track_artists: list[str]
    top_track_artist_ids: list[str]
    top_artist_ids: list[str]

@app.post("/api/analyze-taste")
def analyze_taste(profile: TasteAnalysisRequest):
    unique_artists = set(profile.top_track_artists)

    artist_counts = {}

    for artist_name in profile.top_track_artists:
        if artist_name in artist_counts:
            artist_counts[artist_name] += 1
        else:
            artist_counts[artist_name] = 1
    
    most_repeated_artist = ""
    most_repeated_artist_count = 0

    for artist_name, count in artist_counts.items():
        if count > most_repeated_artist_count:
            most_repeated_artist = artist_name
            most_repeated_artist_count = count
    
    if len(profile.top_track_artists) > 0:
        artist_variety = round((len(unique_artists) / len(profile.top_track_artists)) * 100)
    else:
        artist_variety = 0
    
    track_artist_ids = set(profile.top_track_artist_ids)
    top_artist_overlap = 0

    for artist_id in profile.top_artist_ids:
        if artist_id in track_artist_ids:
            top_artist_overlap += 1
    
    artist_frequency = [
        {"artist_name": artist_name, "count": count}
        for artist_name, count in sorted(
            artist_counts.items(),
            key=lambda item: item[1],
            reverse=True
        )
    ]

    return {
        "unique_artist_count": len(unique_artists),
        "most_repeated_artist": most_repeated_artist,
        "most_repeated_artist_count": most_repeated_artist_count,
        "artist_variety": artist_variety,
        "top_artist_overlap": top_artist_overlap,
        "artist_frequency": artist_frequency
    }

class ArtistFrequency(BaseModel):
    artist_name: str
    count: int

class TasteSummaryRequest(BaseModel):
    top_tracks: list[str]
    top_artists: list[str]
    unique_artist_count: int
    most_repeated_artist: str
    most_repeated_artist_count: int
    artist_variety: int
    top_artist_overlap: int
    artist_frequency: list[ArtistFrequency]
    taste_shift: int
    time_range: str

time_range_labels = {
    "short_term": "last 4 weeks",
    "medium_term": "last 6 months",
    "long_term": "all time",
}

def get_env_value(key: str):
    if os.environ.get(key):
        return os.environ[key]

    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return None

    for line in env_path.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()

    return None


def create_fallback_summary(profile: TasteSummaryRequest, reason: str = "unknown"):
    if profile.artist_variety >= 80:
        variety_description = "wide-ranging"
    elif profile.artist_variety >= 50:
        variety_description = "balanced"
    else:
        variety_description = "focused"

    if profile.most_repeated_artist:
        repeated_artist_description = (
            f"{profile.most_repeated_artist} shows up the most, appearing in "
            f"{profile.most_repeated_artist_count} of your top tracks"
        )
    else:
        repeated_artist_description = "No single artist dominates your top tracks yet"

    top_artist_preview = ", ".join(profile.top_artists[:3])

    summary = (
        f"Your taste profile is {variety_description}: {profile.unique_artist_count} "
        f"unique artists appear across your top tracks. {repeated_artist_description}. "
        f"Your top tracks and top artists overlap in {profile.top_artist_overlap} places, "
        f"which suggests your favorite songs line up pretty closely with your favorite artists."
    )

    if top_artist_preview:
        summary += f" Right now, your artist mix is led by {top_artist_preview}."

    return {"summary": summary, "source": "fallback", "fallback_reason": reason}


def create_taste_prompt(profile: TasteSummaryRequest):
    artist_frequency_text = ", ".join(
        f"{artist.artist_name}: {artist.count}"
        for artist in profile.artist_frequency
    )

    if profile.time_range == "short_term":
        taste_shift_text = f"- Recent taste shift: {profile.taste_shift}% of recent artists are not in the user's all-time top artists"
    else:
        taste_shift_text = "- Recent taste shift: Do not mention recent taste shift for this selected time range"

    time_range_label = time_range_labels.get(profile.time_range, profile.time_range)

    return f"""
Create a concise, specific music taste summary for a Spotify analytics app called SoundPrint.

Use this data:
- Top tracks: {", ".join(profile.top_tracks)}
- Top artists: {", ".join(profile.top_artists)}
- Unique artists in top tracks: {profile.unique_artist_count}
- Most repeated artist in top tracks: {profile.most_repeated_artist}
- Most repeated artist count: {profile.most_repeated_artist_count}
- Artist variety score: {profile.artist_variety}%
- Artists appearing in both top tracks and top artists: {profile.top_artist_overlap}
- Artist frequency in top tracks: {artist_frequency_text}
{taste_shift_text}
- Selected time range: {time_range_label}

Write 3-5 sentences. Focus the summary on the selected time range. Only mention all-time listening when explaining recent taste shift. Sound thoughtful and human, but do not be corny.
Mention patterns in the user's taste. Do not say you are an AI.
"""


def create_gemini_summary(profile: TasteSummaryRequest, api_key: str):
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent"
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": create_taste_prompt(profile)
                    }
                ]
            }
        ]
    }

    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key
        },
        method="POST"
    )

    with urlopen(request, timeout=8) as response:
        data = json.loads(response.read().decode("utf-8"))

    return data["candidates"][0]["content"]["parts"][0]["text"]


@app.post("/api/taste-summary")
def create_taste_summary(profile: TasteSummaryRequest):
    api_key = get_env_value("GEMINI_API_KEY")

    if not api_key:
        return create_fallback_summary(profile, "missing_api_key")

    try:
        summary = create_gemini_summary(profile, api_key)
        return {"summary": summary, "source": "gemini"}
    except HTTPError as error:
        error_body = error.read().decode("utf-8")
        print(f"Gemini HTTP error: {error.code} {error_body}")
        return create_fallback_summary(profile, f"gemini_http_{error.code}")
    except (URLError, TimeoutError) as error:
        print(f"Gemini network error: {error}")
        return create_fallback_summary(profile, "gemini_network_error")
    except (KeyError, IndexError, json.JSONDecodeError) as error:
        print(f"Gemini response parse error: {error}")
        return create_fallback_summary(profile, "gemini_response_parse_error")
    

def call_gemini(prompt: str, api_key: str):
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent"
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ]
    }

    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key
        },
        method="POST"
    )

    with urlopen(request, timeout=8) as response:
        data = json.loads(response.read().decode("utf-8"))

    return data["candidates"][0]["content"]["parts"][0]["text"]

class RecommendArtistsRequest(BaseModel):
    top_artists: list[str]
    top_tracks: list[str]
    recommendation_seeds: list[str]
    artist_frequency: list[ArtistFrequency]
    taste_shift: int
    time_range: str
    top_genres: list[str]
    artist_variety: int
    top_artist_overlap: int
    most_repeated_artist: str
    most_repeated_artist_count: int
    unique_genre_count: int
    
@app.post("/api/recommend-artists")
def recommend_artists(profile: RecommendArtistsRequest):
    recommendations = create_recommended_artists(profile)
    return {
        "recommendations": recommendations
    }

def create_recommend_artist_prompt(profile: RecommendArtistsRequest):
    artist_frequency_text = ", ".join(
        f"{artist.artist_name}: {artist.count}"
        for artist in profile.artist_frequency
    )

    time_range_label = time_range_labels.get(profile.time_range, profile.time_range)

    return f"""
Recommend 4 artists for a Spotify analytics app called SoundPrint.

Use this listening profile:
- Selected time range: {time_range_label}
- Top artists: {", ".join(profile.top_artists)}
- Top tracks: {", ".join(profile.top_tracks)}
- Recommendation seeds: {", ".join(profile.recommendation_seeds)}
- Artist frequency in top tracks: {artist_frequency_text}
- Recent taste shift: {profile.taste_shift}%
- Genres from top artists: {", ".join(profile.top_genres)}
- Artist variety score in top tracks: {profile.artist_variety}%
- Top artist overlap between top tracks and top artists: {profile.top_artist_overlap}
- Most repeated artist in top tracks: {profile.most_repeated_artist}
- Most repeated artist count: {profile.most_repeated_artist_count}
- Unique genre count: {profile.unique_genre_count}

Return only JSON in this exact format:
[
  {{
    "name": "Artist Name",
    "reason": "One short sentence explaining why this artist fits."
  }}
]

Rules:
- Do not recommend artists already listed in top artists.
- Do not recommend artists already listed as recommendation seeds.
- Prefer real, well-known artists that are likely available on Spotify.
- Keep each reason specific to the user's listening taste.
"""

def create_recommended_artists(profile: RecommendArtistsRequest):
    api_key = get_env_value("GEMINI_API_KEY")

    if not api_key:
        return []

    prompt = create_recommend_artist_prompt(profile)

    try:
        response_text = call_gemini(prompt, api_key)
        cleaned_response = response_text.strip()

        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response.removeprefix("```json").removesuffix("```").strip()
        elif cleaned_response.startswith("```"):
            cleaned_response = cleaned_response.removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned_response)
    except Exception:
        return []