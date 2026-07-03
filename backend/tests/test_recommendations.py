from main import score_signal, validate_recommendations, classify_recommendation, RecommendArtistsRequest

def test_score_signal():
    assert(score_signal("Marvin Gaye frequency") > score_signal("50% taste shift"))

def test_validate_recommendations():
    profile = RecommendArtistsRequest(
        top_artists=["Marvin Gaye"],
        top_tracks=[""],
        recommendation_seeds=[""],
        artist_frequency=[],
        taste_shift=60,
        time_range="medium_term",
        top_genres=[],
        artist_variety=80,
        top_artist_overlap=3,
        most_repeated_artist="...",
        most_repeated_artist_count=2,
        unique_genre_count=0
    )

    recommendations = [
        {"name": "Marvin Gaye", "reason": "...", "signals": [...]},
        {"name": "Steely Dan", "reason": "...", "signals": [...]}
    ]

    result = validate_recommendations(profile, recommendations)

    names = [recommendation["name"] for recommendation in result]

    assert("Marvin Gaye" not in names and "Steely Dan" in names)