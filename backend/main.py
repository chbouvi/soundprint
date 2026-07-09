import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

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

def get_allowed_origins():
    frontend_url = get_env_value("FRONTEND_URL")

    origins = ["http://127.0.0.1:5173"]

    if frontend_url:
        origins.append(frontend_url)
    
    return origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
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

def create_fallback_sound_profile(profile: TasteSummaryRequest):
    return [
        {"tag": "artist variety", "count": 1},
        {"tag": "top artist overlap", "count": 1},
        {"tag": "recent taste shift", "count": 1}
    ]


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

    return {
        "summary": summary, 
        "source": "fallback", 
        "fallback_reason": reason, 
        "sound_profile": create_fallback_sound_profile(profile)
    }


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

Return only JSON in this exact format: 
{{
    "summary": "3-5 sentence taste summary",
    "sound_profile_items": [
        {{
            "name": "top artist or repeated top-track artist",
            "tags": ["reusable genre/style tag", "reusable genre/style tag", "reusable genre/style tag"]
        }}
    ]
}}

Use repeated, reusable tags when multiple artists or tracks share a similar sound. Avoid overly specific descriptions.

"""


def create_gemini_taste_profile(profile: TasteSummaryRequest, api_key: str):
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
        taste_profile = create_gemini_taste_profile(profile, api_key)

        cleaned_response = taste_profile.strip()

        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response.removeprefix("```json").removesuffix("```").strip()
        elif cleaned_response.startswith("```"):
            cleaned_response = cleaned_response.removeprefix("```").removesuffix("```").strip()
        taste_profile = json.loads(cleaned_response)

        return {
            "summary": taste_profile["summary"], 
            "source": "gemini", 
            "sound_profile": count_sound_profile_tags(taste_profile["sound_profile_items"])
        }
    except HTTPError as error:
        error_body = error.read().decode("utf-8")
        print(f"Gemini HTTP error: {error.code} {error_body}")
        return create_fallback_summary(profile, f"gemini_http_{error.code}")
    except (URLError, TimeoutError) as error:
        print(f"Gemini network error: {error}")
        return create_fallback_summary(profile, "gemini_network_error")
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as error:
        print(f"Gemini response parse error: {error}")
        return create_fallback_summary(profile, "gemini_response_parse_error")
    
def count_sound_profile_tags(sound_profile_items):
    tag_counts: dict[str, int] = {}

    for sound_profile_item in sound_profile_items:
        for tag in sound_profile_item["tags"]:
            if tag in tag_counts:
                tag_counts[tag] += 1
            else:
                tag_counts[tag] = 1

    sound_profile = [
        {"tag": tag, "count": count}
        for tag, count in sorted(
            tag_counts.items(),
            key=lambda item: item[1],
            reverse=True
        )
    ]

    return sound_profile

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
    good_fit_artists: list[str]
    already_known_artists: list[str]
    not_for_me_artists: list[str]
    
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
- Good fit artists: {profile.good_fit_artists}
- Already known artists: {profile.already_known_artists}
- Not for me artists: {profile.not_for_me_artists}

Return only JSON in this exact format:
[
  {{
    "name": "Artist Name",
    "reason": "One short sentence explaining why this artist fits.",
    "signals": ["short signal label", "short signal label"]
  }}
]

Rules:
- Do not recommend artists already listed in top artists.
- Do not recommend artists already listed as recommendation seeds.
- Prefer real, well-known artists that are likely available on Spotify.
- Keep each reason specific to the user's listening taste.
- Each recommendation must include "signals" as a list of 2-3 short strings.
- Each signal should describe a real listening-profile feature that supports the recommendation.
- Signals should be specific to the user's data, not generic filler.
- Good signal styles include genre-based labels, seed-artist labels, artist-frequency labels, taste-shift labels, variety labels, or overlap labels.
- Keep each signal 1-4 words.
- Use the good fit artists to recommend similar vibes.
- Use the already known artists to use as a taste signal but avoid recommending the same exact artist.
- Use the not for me artists to avoid these artists.
"""

def validate_recommendations(profile: RecommendArtistsRequest, recommendations):
    blocked_artist_names = {
        artist_name.strip().lower()
        for artist_name in profile.top_artists + profile.recommendation_seeds + profile.not_for_me_artists + profile.already_known_artists
    }
    
    seen_artist_names = set()
    valid_recommendations = []

    for recommendation in recommendations:
        name = recommendation.get("name")
        reason = recommendation.get("reason")
        signals = recommendation.get("signals")

        if not name or not reason:
            continue

        if not isinstance(signals, list):
            signals = []

        normalized_name = name.strip().lower()

        if normalized_name in blocked_artist_names:
            continue

        if normalized_name in seen_artist_names:
            continue

        clean_signals = []
        
        for signal in signals:
            if not isinstance(signal, str):
                continue

            clean_signal = signal.strip()

            if not clean_signal:
                continue

            clean_signals.append(clean_signal)

        clean_signals = clean_signals[:3]

        score_result = calculate_recommendation_score(profile, clean_signals)

        valid_recommendations.append({
            "name": name,
            "reason": reason,
            "signals": clean_signals,
            "score": score_result["score"],
            "score_factors": score_result["score_factors"],
            "recommendation_type": classify_recommendation(clean_signals)
        })

        seen_artist_names.add(normalized_name)
    
    return valid_recommendations[:4]

def score_signal(signal: str):
    normalized_signal = signal.lower()

    if "genre" in normalized_signal or "style" in normalized_signal or "sound" in normalized_signal:
        return 10
    
    if "seed" in normalized_signal or "affinity" in normalized_signal or "influence" in normalized_signal:
        return 9
    
    if "frequency" in normalized_signal or "repeated" in normalized_signal:
        return 8
    
    if "overlap" in normalized_signal:
        return 7
    
    if "variety" in normalized_signal:
        return 6
    
    if "shift" in normalized_signal:
        return 5
    
    return 4

def classify_recommendation(signals):
    default = "Discovery pick"

    for signal in signals:
        normalized_signal = signal.lower()
        if "shift" in normalized_signal:
            return "Bridge pick"
    
    for signal in signals:
        normalized_signal = signal.lower()
        if "seed" in normalized_signal or "frequency" in normalized_signal or "repeated" in normalized_signal or "affinity" in normalized_signal or "influence" in normalized_signal:
            return "Close match"
        
    return default
    
def calculate_recommendation_score(profile: RecommendArtistsRequest, signals: list[str]):
    score = 60
    score_factors = []

    for signal in signals:
        points = score_signal(signal)
        score += points
        score_factors.append({
            "label": signal,
            "points": points
        })
    
    if profile.artist_variety >= 75:
        score += 6
        score_factors.append({
            "label": "High artist variety",
            "points": 6
        })
    
    if profile.top_artist_overlap >= 3:
        score += 5
        score_factors.append({
            "label": "Top artist overlap",
            "points": 5
        })

    if profile.taste_shift >= 50:
        score += 4
        score_factors.append({
            "label": "Recent taste shift",
            "points": 4
        })
    
    if score > 95:
        score = 95
    
    return {
        "score": score,
        "score_factors": score_factors
    }

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
        recommendations = json.loads(cleaned_response)

        if not isinstance(recommendations, list):
            return []
        
        return validate_recommendations(profile, recommendations)
    except Exception:
        return []
