from main import score_signal, validate_recommendations, classify_recommendation, RecommendArtistsRequest

def make_test_profile():
    return RecommendArtistsRequest(
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
            unique_genre_count=0,
            good_fit_artists=["Tame Impala"],
            already_known_artists=["Thundercat"],
            not_for_me_artists=["MF Doom"],
        )

def test_score_signal():
    assert score_signal("Marvin Gaye frequency") > score_signal("50% taste shift")

def test_validate_recommendations():
    profile = make_test_profile()

    recommendations = [
        {"name": "Marvin Gaye", "reason": "...", "signals": ["50% taste shift"]},
        {"name": "Steely Dan", "reason": "...", "signals": ["Jazz fusion influence"]}
    ]

    result = validate_recommendations(profile, recommendations)

    names = [recommendation["name"] for recommendation in result]

    assert "Marvin Gaye" not in names
    assert "Steely Dan" in names

def test_validate_recommendations_filters_missing_name():
    profile = make_test_profile()

    recommendations = [
        {"name": "Steely Dan", "reason": "...", "signals": ["50% taste shift"]},
        {"name": "", "reason": "...", "signals": ["Jazz fusion influence"]}
    ]

    result = validate_recommendations(profile, recommendations)

    names = [recommendation["name"] for recommendation in result]

    assert "" not in names
    assert "Steely Dan" in names

def test_validate_recommendations_filters_duplicates(): 
    profile = make_test_profile()

    recommendations = [
        {"name": "Steely Dan", "reason": "...", "signals": ["50% taste shift"]},
        {"name": "Steely Dan", "reason": "...", "signals": ["Jazz fusion influence"]}
    ]

    result = validate_recommendations(profile, recommendations)

    names = [recommendation["name"] for recommendation in result]

    assert names == ["Steely Dan"]

def test_validate_recommendations_limit():
    profile = make_test_profile()

    recommendations = [
        {"name": "Curtis Mayfield", "reason": "...", "signals": ["50% taste shift"]},
        {"name": "Steely Dan", "reason": "...", "signals": ["Jazz fusion influence"]},
        {"name": "Fleetwood Mac", "reason": "...", "signals": ["Art rock complexity"]},
        {"name": "Pink Floyd", "reason": "...", "signals": ["Psychedelic rock affinity"]},
        {"name": "Tame Impala", "reason": "...", "signals": ["Pink Floyd affinity"]}
    ]

    result = validate_recommendations(profile, recommendations)

    names = [recommendation["name"] for recommendation in result]

    assert len(names) == 4
    assert "Tame Impala" not in names

def test_validate_recommendations_handles_bad_signals():
    profile = make_test_profile()

    recommendations = [
        {"name": "Curtis Mayfield", "reason": "...", "signals": ["50% taste shift"]},
        {"name": "Steely Dan", "reason": "...", "signals": "Jazz fusion influence"},
        {"name": "Fleetwood Mac", "reason": "...", "signals": ["Art rock complexity"]},
    ]

    result = validate_recommendations(profile, recommendations)

    signals = [recommendation["signals"] for recommendation in result]

    assert [] in signals

def test_validate_recommendations_filters_missing_reason():
    profile = make_test_profile()

    recommendations = [
        {"name": "Curtis Mayfield", "reason": "", "signals": ["50% taste shift"]},
        {"name": "Steely Dan", "reason": "...", "signals": "Jazz fusion influence"},
        {"name": "Fleetwood Mac", "reason": "...", "signals": ["Art rock complexity"]},
    ]

    result = validate_recommendations(profile, recommendations)

    names = [recommendation["name"] for recommendation in result]

    assert "Curtis Mayfield" not in names
    assert "Steely Dan" in names
    assert "Fleetwood Mac" in names

def test_validate_recommendations_filters_not_for_me():
    profile = make_test_profile()

    recommendations = [
        {"name": "Curtis Mayfield", "reason": "...", "signals": ["50% taste shift"]},
        {"name": "Steely Dan", "reason": "...", "signals": "Jazz fusion influence"},
        {"name": "Fleetwood Mac", "reason": "...", "signals": ["Art rock complexity"]},
        {"name": "MF Doom", "reason": "...", "signals": ["2000's rap affinity"]},
    ]

    result = validate_recommendations(profile, recommendations)

    names = [recommendation["name"] for recommendation in result]

    assert "MF Doom" not in names
    assert "Steely Dan" in names
    assert "Fleetwood Mac" in names
    assert "Curtis Mayfield" in names

def test_validate_recommendations_filters_already_known():
    profile = make_test_profile()

    recommendations = [
        {"name": "Curtis Mayfield", "reason": "...", "signals": ["50% taste shift"]},
        {"name": "Steely Dan", "reason": "...", "signals": "Jazz fusion influence"},
        {"name": "Fleetwood Mac", "reason": "...", "signals": ["Art rock complexity"]},
        {"name": "Thundercat", "reason": "...", "signals": ["Funk affinity"]},
    ]

    result = validate_recommendations(profile, recommendations)

    names = [recommendation["name"] for recommendation in result]

    assert "Thundercat" not in names
    assert "Steely Dan" in names
    assert "Fleetwood Mac" in names
    assert "Curtis Mayfield" in names

def test_validate_recommendations_keeps_good_fit():
    profile = make_test_profile()

    recommendations = [
        {"name": "Curtis Mayfield", "reason": "...", "signals": ["50% taste shift"]},
        {"name": "Steely Dan", "reason": "...", "signals": "Jazz fusion influence"},
        {"name": "Fleetwood Mac", "reason": "...", "signals": ["Art rock complexity"]},
        {"name": "Tame Impala", "reason": "...", "signals": ["Psychedelic rock affinity"]},
    ]

    result = validate_recommendations(profile, recommendations)

    names = [recommendation["name"] for recommendation in result]

    assert "Tame Impala" in names
    assert "Steely Dan" in names
    assert "Fleetwood Mac" in names
    assert "Curtis Mayfield" in names

def test_classify_recommendation():
    bridge_signals = ["50% taste shift"]
    close_signals = ["Jazz fusion influence"]
    discovery_signals = ["Motown soul depth"]


    bridge_result = classify_recommendation(bridge_signals)

    assert bridge_result == "Bridge pick"

    close_result = classify_recommendation(close_signals)

    assert close_result == "Close match"

    discovery_result = classify_recommendation(discovery_signals)

    assert discovery_result == "Discovery pick"