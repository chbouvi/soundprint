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

    return {
        "unique_artist_count": len(unique_artists),
        "most_repeated_artist": most_repeated_artist,
        "most_repeated_artist_count": most_repeated_artist_count
    }


class TasteSummaryRequest(BaseModel):
    top_tracks: list[str]
    top_artists: list[str]
    unique_artist_count: int
    most_repeated_artist: str
    most_repeated_artist_count: int
    artist_variety: int
    top_artist_overlap: int


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

Write 3-5 sentences. Sound thoughtful and human, but do not be corny.
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
