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


class TasteSummaryRequest(BaseModel):
    top_tracks: list[str]
    top_artists: list[str]
    unique_artist_count: int
    most_repeated_artist: str
    most_repeated_artist_count: int
    artist_variety: int
    top_artist_overlap: int


@app.post("/api/taste-summary")
def create_taste_summary(profile: TasteSummaryRequest):
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

    return {"summary": summary}
