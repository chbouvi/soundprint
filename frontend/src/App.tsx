import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import './App.css'


type ArtistImage = {
  url: string
}

type Artist = {
  id: string
  name: string
  images: ArtistImage[]
  genres?: string[]
}

type AlbumImage = {
  url: string
}

type Album = {
  images: AlbumImage[]
}

type Track = {
  id: string
  name: string
  artists: Artist[]
  album: Album
}

type ArtistFrequency = {
  artist_name: string
  count: number
}

type TasteAnalysis = {
  unique_artist_count: number
  most_repeated_artist: string
  most_repeated_artist_count: number
  artist_variety: number
  top_artist_overlap: number
  artist_frequency: ArtistFrequency[]
}

type RecommendedArtist = {
  name: string
  reason: string
  signals: string[]
  score: number
  score_factors: ScoreFactor[]
  recommendation_type: string
  imageUrl?: string | null
  spotifyUrl?: string | null
}

type SpotifyArtistSearchResult = {
  name: string
  external_urls: {
    spotify: string
  }
  images: {
    url: string
  }[]
}

type ScoreFactor = {
  label: string
  points: number
}

type SoundProfileTag = {
  tag: string
  count: number
}

type RecommendationFeedback = "good_fit" | "already_know" | "not_for_me"

function App() {
  const generateRandomString = (length: number) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

  const sha256 = async (plain: string) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return window.crypto.subtle.digest('SHA-256', data)
  }

  const base64encode = (input: ArrayBuffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  const clientId = "fe6329b37eec4232b3732bb7f9d01fc6"
  const redirectUri = "http://127.0.0.1:5173/callback"
  const spotifyAuthUrl = "https://accounts.spotify.com/authorize"
  const scope = "user-top-read"
  const responseType = "code"

  async function handleConnectSpotify() {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64encode(hashed);
    const codeChallengeMethod = 'S256'

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: responseType,
      scope: scope,
      code_challenge_method: codeChallengeMethod,
      code_challenge: codeChallenge,
      redirect_uri: redirectUri
    })
    localStorage.setItem("code_verifier", codeVerifier)
    window.location.href = spotifyAuthUrl + "?" + params.toString()
  }

  const params = new URLSearchParams(window.location.search)
  const code = params.get("code")

  const codeVerifier = localStorage.getItem("code_verifier")

  const [timeRange, setTimeRange] = useState("medium_term")

  const [errorMessage, setErrorMessage] = useState<string>("")
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    if (code && codeVerifier) {
      fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.access_token) {
            setAccessToken(data.access_token)
            setErrorMessage("")
            window.history.replaceState({}, "", "/")
          } else if (data.error) {
            setErrorMessage(data.error)
          } else {
            setErrorMessage("Could not connect to Spotify.")
          }
        })
        .catch(() => setErrorMessage("Could not connect to Spotify."))
    }
  }, [code, codeVerifier])

  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [isLoadingArtists, setIsLoadingArtists] = useState(false)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)

  const [topTracks, setTopTracks] = useState<Track[]>([])

  useEffect(() => {
    if (!accessToken) return 

    setIsLoadingTracks(true)
    setErrorMessage("")

    fetch(`https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=${timeRange}`, {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + accessToken
      }
    })
      .then(response => response.json())
      .then(data => {
        if (data.items) {
          setTopTracks(data.items)
        } else {
          setErrorMessage("Could not load top tracks.")
        }
      })
      .catch(() => setErrorMessage("Could not load top tracks."))
      .finally(() => setIsLoadingTracks(false))
  }, [accessToken, timeRange])

  const [topArtists, setTopArtists] = useState<Artist[]>([])

  useEffect(() => {
    if (!accessToken) return

    setIsLoadingArtists(true)
    setErrorMessage("")

    fetch(`https://api.spotify.com/v1/me/top/artists?limit=10&time_range=${timeRange}`, {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + accessToken
      }
    })
      .then(response => response.json())
      .then(data => {
        if (data.items) {
          setTopArtists(data.items)
        } else {
          setErrorMessage("Could not load top artists.")
        }
      })
      .catch(() => setErrorMessage("Could not load top artists."))
      .finally(() => setIsLoadingArtists(false))
  }, [accessToken, timeRange])

  const [shortTermArtists, setShortTermArtists] = useState<Artist[]>([])
  const [longTermArtists, setLongTermArtists] = useState<Artist[]>([])
  const [mediumTermArtists, setMediumTermArtists] = useState<Artist[]>([])
  const [isLoadingTasteShift, setIsLoadingTasteShift] = useState(false)

  useEffect(() => {
    if (!accessToken) return

    setIsLoadingTasteShift(true)

    const shortTermRequest = fetch("https://api.spotify.com/v1/me/top/artists?limit=10&time_range=short_term", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + accessToken
      }
    })
      .then(response => response.json())
      .then(data => {
        if (data.items) {
          setShortTermArtists(data.items)
        }
      })
    
    const mediumTermRequest = fetch("https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + accessToken
      }
    })
      .then(response => response.json()) 
      .then(data => {
        if (data.items) {
          setMediumTermArtists(data.items)
        }
      })

    const longTermRequest = fetch("https://api.spotify.com/v1/me/top/artists?limit=10&time_range=long_term", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + accessToken
      }
    })
      .then(response => response.json())
      .then(data => {
        if (data.items) {
          setLongTermArtists(data.items)
        }
      })
    Promise.all([shortTermRequest, mediumTermRequest, longTermRequest])
      .finally(() => setIsLoadingTasteShift(false))
  }, [accessToken])  
  
  const shortTermArtistIds = shortTermArtists.map(artist => artist.id)
  const shortTermArtistSet = new Set(shortTermArtistIds)

  const mediumTermArtistIds = mediumTermArtists.map(artist => artist.id)
  const mediumTermArtistSet = new Set(mediumTermArtistIds)

  const longTermArtistIds = longTermArtists.map(artist => artist.id)
  const longTermArtistSet = new Set(longTermArtistIds)

  const stableArtists = shortTermArtists.filter(artist => longTermArtistSet.has(artist.id))
  const newRecentArtists = shortTermArtists.filter(artist => !longTermArtistSet.has(artist.id))

  const consistentAcrossAll = shortTermArtists.filter(artist => mediumTermArtistSet.has(artist.id) && longTermArtistSet.has(artist.id))
  const consistentAcrossAllIds = consistentAcrossAll.map(artist => artist.id)
  const consistentAcrossAllSet = new Set(consistentAcrossAllIds)

  const mediumTermBridgeArtists = mediumTermArtists.filter(artist => 
    (shortTermArtistSet.has(artist.id) || longTermArtistSet.has(artist.id)) &&
    !consistentAcrossAllSet.has(artist.id)
  )

  const tasteShift = shortTermArtists.length > 0
    ? Math.round((1 - (stableArtists.length / shortTermArtists.length)) * 100)
    : 0

  const topGenres = useMemo(() => {
    return [...new Set(topArtists.flatMap(artist => artist.genres ?? []))]
  }, [topArtists])

  const uniqueGenreCount = topGenres.length

  const [tasteAnalysis, setTasteAnalysis] = useState<TasteAnalysis | null>(null)
  const [tasteSummary, setTasteSummary] = useState("")
  const [tasteSummarySource, setTasteSummarySource] = useState("")
  const [tasteSummaryFallbackReason, setTasteSummaryFallbackReason] = useState("")
  const [isTasteSummaryLoading, setIsTasteSummaryLoading] = useState(false)
  
  const overlappingArtists = useMemo(() => {
    const topTrackArtistIds = topTracks.map(track => track.artists[0].id)
    const topTrackArtistSet = new Set(topTrackArtistIds)

    return topArtists.filter(artist => topTrackArtistSet.has(artist.id))
  }, [topTracks, topArtists])

  const uniqueRecommendationSeeds = useMemo(() => {
    const recommendationSeeds: string[] = []

    overlappingArtists.forEach(artist => {
      recommendationSeeds.push(artist.name)
    })

    if (tasteAnalysis?.most_repeated_artist) {
      recommendationSeeds.push(tasteAnalysis.most_repeated_artist)
    }

    topArtists.forEach(artist => {
      recommendationSeeds.push(artist.name)
    })

    return [...new Set(recommendationSeeds)].slice(0, 5)
  }, [overlappingArtists, tasteAnalysis?.most_repeated_artist, topArtists])

  const [recommendedArtists, setRecommendedArtists] = useState<RecommendedArtist[]>([])
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [recommendationError, setRecommendationError] = useState("")

  useEffect(() => {
    setTasteAnalysis(null)
    setTasteSummary("")
    setTasteSummarySource("")
    setTasteSummaryFallbackReason("")
    setRecommendedArtists([])
    setRecommendationError("")
    setTopTracks([])
    setTopArtists([])
  }, [timeRange])

  useEffect(() => {
    if (!accessToken || topTracks.length <= 0 || topArtists.length <= 0) return

    setIsLoadingAnalysis(true)
    setErrorMessage("")

    fetch("http://127.0.0.1:8000/api/analyze-taste", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        top_track_artists: topTracks.map(track => track.artists[0].name),
        top_track_artist_ids: topTracks.map(track => track.artists[0].id),
        top_artist_ids: topArtists.map(artist => artist.id)
      })
    })
      .then(response => response.json())
      .then(data => {
        setTasteAnalysis(data)
      })
      .catch(() => setErrorMessage("Could not analyze taste."))
      .finally(() => setIsLoadingAnalysis(false))
  }, [accessToken, topTracks, topArtists])

  const artistFrequencyChartData = tasteAnalysis
    ? tasteAnalysis.artist_frequency.slice(0, 5)
    : []

  const [soundProfile, setSoundProfile] = useState<SoundProfileTag[]>([])

  useEffect(() => {
    if (accessToken && topTracks.length > 0 && topArtists.length > 0 && tasteAnalysis) {
      setTasteSummary("")
      setTasteSummarySource("")
      setTasteSummaryFallbackReason("")
      setIsTasteSummaryLoading(true)

      fetch("http://127.0.0.1:8000/api/taste-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          top_tracks: topTracks.map(track => track.name),
          top_artists: topArtists.map(artist => artist.name),
          unique_artist_count: tasteAnalysis.unique_artist_count,
          most_repeated_artist: tasteAnalysis.most_repeated_artist,
          most_repeated_artist_count: tasteAnalysis.most_repeated_artist_count,
          artist_variety: tasteAnalysis.artist_variety,
          top_artist_overlap: tasteAnalysis.top_artist_overlap,
          artist_frequency: tasteAnalysis.artist_frequency,
          taste_shift: tasteShift,
          time_range: timeRange
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.summary) {
            setTasteSummary(data.summary)
            setSoundProfile(data.sound_profile ?? [])
            setTasteSummarySource(data.source)
            setTasteSummaryFallbackReason(data.fallback_reason || "")
          } else {
            setErrorMessage("Could not load taste summary.")
          }
        })
        .catch(() => setErrorMessage("Could not load taste summary."))
        .finally(() => setIsTasteSummaryLoading(false))
    }
  }, [
    accessToken,
    topTracks,
    topArtists,
    tasteAnalysis?.unique_artist_count,
    tasteAnalysis?.most_repeated_artist,
    tasteAnalysis?.most_repeated_artist_count,
    tasteAnalysis?.artist_variety,
    tasteAnalysis?.top_artist_overlap,
    tasteAnalysis?.artist_frequency,
    tasteShift
  ])

  const styleTagFrequencyChartData = soundProfile.slice(0, 5)

  const [recommendationFeedback, setRecommendationFeedback] = useState<Record<string, RecommendationFeedback>>(() => {
    const savedFeedback = localStorage.getItem("recommendationFeedback")

    if (savedFeedback) {
      return JSON.parse(savedFeedback)
    }

    return {}
  })

  const recommendationFeedbackArray = Object.entries(recommendationFeedback)

  const goodFitList = recommendationFeedbackArray
    .filter(([, feedback]) => feedback === "good_fit")
    .map(([artistName]) => artistName)
  
  const alreadyKnownList = recommendationFeedbackArray
    .filter(([, feedback]) => feedback === "already_know")
    .map(([artistName]) => artistName)

  const notForMeList = recommendationFeedbackArray
    .filter(([, feedback]) => feedback === "not_for_me")
    .map(([artistName]) => artistName)

  useEffect(() => {
    localStorage.setItem(
      "recommendationFeedback",
      JSON.stringify(recommendationFeedback)
    )
  }, [recommendationFeedback])

  const visibleRecommendations = recommendedArtists.filter((recommendedArtist) => recommendationFeedback[recommendedArtist.name] !== "not_for_me")

  useEffect(() => {
    if (accessToken && topTracks.length > 0 && topArtists.length > 0 && tasteAnalysis && uniqueRecommendationSeeds.length > 0) {
      setRecommendationError("")
      setIsLoadingRecommendations(true)

      fetch("http://127.0.0.1:8000/api/recommend-artists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          top_artists: topArtists.map(artist => artist.name),
          top_tracks: topTracks.map(track => track.name),
          recommendation_seeds: uniqueRecommendationSeeds,
          artist_frequency: tasteAnalysis.artist_frequency,
          taste_shift: tasteShift,
          time_range: timeRange,
          top_genres: topGenres,
          artist_variety: tasteAnalysis.artist_variety,
          top_artist_overlap: tasteAnalysis.top_artist_overlap,
          most_repeated_artist: tasteAnalysis.most_repeated_artist,
          most_repeated_artist_count: tasteAnalysis.most_repeated_artist_count,
          unique_genre_count: uniqueGenreCount,
          good_fit_artists: goodFitList,
          already_known_artists: alreadyKnownList,
          not_for_me_artists: notForMeList,
        })
      })
        .then(response => response.json())
        .then(async data => {
          if (data.recommendations) {
            const recommendations = data.recommendations as RecommendedArtist[]
            const recommendationsWithUrls = await Promise.all(
              recommendations.map(async recommendedArtist => {
                const spotifyArtistDetails = await getSpotifyArtistDetails(recommendedArtist.name)

                return {
                  ...recommendedArtist,
                  spotifyUrl: spotifyArtistDetails?.spotifyUrl ?? null,
                  imageUrl: spotifyArtistDetails?.imageUrl ?? null
                }
              })
            )
            setRecommendedArtists(recommendationsWithUrls)
          } else {
            setRecommendationError("Could not load recommendation artists.")
          }
        })
        .catch(() => setRecommendationError("Could not load recommended artists."))
        .finally(() => setIsLoadingRecommendations(false))
    }
  }, [accessToken, tasteAnalysis, topArtists, topTracks, uniqueRecommendationSeeds, tasteShift, timeRange, topGenres, uniqueGenreCount])


  const getSpotifySearchUrl = (artistName: string) => {
    return `https://open.spotify.com/search/${encodeURIComponent(artistName)}`
  }

  async function getSpotifyArtistDetails(artistName: string) {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=5`,
        {
          headers: {
            Authorization: "Bearer " + accessToken
          }
        }
      )

      const data = await response.json()
      const artists = data.artists.items as SpotifyArtistSearchResult[]
      const matchingArtist = artists.find(artist => 
        artist.name.toLowerCase() === artistName.toLowerCase()
      )

      if (!matchingArtist) {
        return null
      }

      return {
        spotifyUrl: matchingArtist.external_urls.spotify,
        imageUrl: matchingArtist.images[0]?.url ?? null
      }
    } catch {
       return null
    }
  }

  const [openScoreDetails, setOpenScoreDetails] = useState<string | null>(null)

  const [removedRecommendationMessage, setRemovedRecommendationMessage] = useState("")

  return (
    <main>
      <h1>SoundPrint</h1>
      <h2>Your music taste, simplified</h2>

      {!accessToken && (
        <button className="connect-button" onClick={handleConnectSpotify}>
          Connect Spotify
        </button>
      )}

      {accessToken && (
        <div className="time-range-control">
          <label htmlFor="time-range">Time range</label>

          <select
            id="time-range"
            value={timeRange}
            onChange={event => setTimeRange(event.target.value)}
          >
            <option value="short_term">Last 4 weeks</option>
            <option value="medium_term">Last 6 months</option>
            <option value="long_term">All time</option>
          </select>
        </div>
      )}

      {errorMessage && (
        <p>Error: {errorMessage}</p>
      )}

      {accessToken && (isLoadingTracks || isLoadingArtists || isLoadingAnalysis) && (
        <p>Loading your SoundPrint profile...</p>
      )}
      
      {accessToken && tasteAnalysis && (
      <section className="stats-panel">
        <div className="stat-card">
          <span className="stat-label">Unique Artists</span>
          <strong>{tasteAnalysis?.unique_artist_count}</strong>
          <span className="stat-caption">across your top tracks</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Most Repeated Artist</span>
          <strong>{tasteAnalysis?.most_repeated_artist}</strong>
          <span className="stat-caption">appears in {tasteAnalysis?.most_repeated_artist_count} top tracks</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Artist Variety</span>
          <strong>{tasteAnalysis?.artist_variety}%</strong>
          <span className="stat-caption">across your top tracks</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Top Artist Overlap</span>
          <strong>{tasteAnalysis?.top_artist_overlap}</strong>
          <span className="stat-caption">top artists also in your top tracks</span>
        </div>
        {uniqueGenreCount > 0 && (
          <div className="stat-card">
            <span className="stat-label">Unique Genres</span>
            <strong>{uniqueGenreCount}</strong>
            <span className="stat-caption">across your top artists</span>
          </div>
        )}
        <div className="stat-card">
          <span className="stat-label">Recent Taste Shift</span>
          <strong>{isLoadingTasteShift ? "..." : `${tasteShift}%`}</strong>
          <span className="stat-caption">of recent artists are not in your all-time top artists</span>

          {newRecentArtists.length > 0 && (
            <div className="taste-shift-details">
              <p className="taste-shift-label">Examples</p>
              <div className="taste-shift-artists">
                {newRecentArtists.slice(0, 3).map(artist => (
                  <span key={artist.name} className="taste-shift-pill">{artist.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {accessToken && !isLoadingTasteShift && (newRecentArtists.length > 0 || mediumTermBridgeArtists.length > 0 || consistentAcrossAll.length > 0) && (
        <section className="taste-comparison-card">
          <h3>Taste Timeline</h3>
          <p className="taste-comparison-caption">
            Short-term, six-month, and all-time artists compared.
          </p>
          <div className="taste-comparison-groups">
            <div className="taste-comparison-group">
              <h4>New recently</h4>
              <div className="taste-comparison-pills">
                {newRecentArtists.slice(0, 5).map(artist => (
                  <span key={artist.name} className="new-recent-pill">{artist.name}</span>
                ))}
              </div>
            </div>

            <div className="taste-comparison-group">
              <h4>Six-month bridge</h4>
              <div className="taste-comparison-pills">
                {mediumTermBridgeArtists.slice(0,5).map(artist => (
                  <span key={artist.name} className="six-month-pill">{artist.name}</span>
                ))}
              </div>
            </div>

            <div className="taste-comparison-group">
              <h4>Consistent across all</h4>
              <div className="taste-comparison-pills">
                {consistentAcrossAll.slice(0, 5).map(artist => (
                  <span key={artist.name} className="consistent-pill">{artist.name}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="insights-grid">
      {accessToken && tasteAnalysis && (
        <section className="chart-card">
          <div className="chart-heading">
            <h3>Top Artist Frequency</h3>
            <p>Artists appearing most often across your top tracks.</p>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={artistFrequencyChartData} margin={{ top: 8, right: 24, left: 32, bottom: 8 }} layout="vertical">
              <XAxis type="number" domain={[0, "dataMax"]} allowDecimals={false} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="artist_name" width={130} interval={0} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false}/>
              <Tooltip 
                cursor={{ fill: "rgba(156, 163, 175, 0.08)"}}
                contentStyle={{
                  background: "#191a20",
                  border: "1px solid #2d2d36",
                  borderRadius: "8px",
                  color: "#d1d5db"
                }}
                labelStyle={{
                  color: "#f3f4f6",
                  fontWeight: 700
                }}
                itemStyle={{
                  color: "#9cff38"
                }}
                formatter={(value) => {
                  value = Number(value)
                  if (value === 1) {
                    return [1, "top track"]
                  } else {
                    return [value, "top tracks"]
                  }
                }}
              />
              <Bar dataKey="count" fill="#9cff38" radius={[0, 8, 8, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {accessToken && (isTasteSummaryLoading || soundProfile.length > 0) && (
        <section className="chart-card">
          <div className="chart-heading">
            <h3>Sound Profile Breakdown</h3>
          </div>

          {isTasteSummaryLoading ? (
            <p className="chart-loading">Building sound profile...</p>
          ) : (
            <>
              <p>AI-generated style tags counted across your listening profile.</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={styleTagFrequencyChartData} margin={{ top: 8, right: 24, left: 32, bottom: 8 }} layout="vertical">
                  <XAxis type="number" domain={[0, "dataMax"]} allowDecimals={false} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="tag" width={190} interval={0} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false}/>
                  <Tooltip
                    cursor={{ fill: "rgba(156, 163, 175, 0.08)"}}
                    contentStyle={{
                      background: "#191a20",
                      border: "1px solid #2d2d36",
                      borderRadius: "8px",
                      color: "#d1d5db"
                    }}
                    labelStyle={{
                      color: "#f3f4f6",
                      fontWeight: 700
                    }}
                    itemStyle={{
                      color: "#9cff38"
                    }}
                    formatter={(value) => {
                      value = Number(value)
                      if (value === 1) {
                        return [1, "tag"]
                      } else {
                        return [value, "tags"]
                      }
                    }}
                  />
                  <Bar dataKey="count" fill="#9cff38" radius={[0, 8, 8, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </section>
      )}

      {(isTasteSummaryLoading || tasteSummary) && (
        <section className="summary-card">
          <span className="summary-label">
            {tasteSummarySource === "gemini" ? "AI Taste Summary" : "Taste Summary Preview"}
          </span>
          {tasteSummaryFallbackReason && (
            <span className="summary-source">Using fallback: {tasteSummaryFallbackReason}</span>
          )}
          <p>
            {isTasteSummaryLoading ? "Generating taste summary..." : tasteSummary}
          </p>
        </section>
      )}
      </div>

      {accessToken && tasteAnalysis && (
      <section className="seed-card">
          <h3>Recommendation Seeds</h3>

          <div className="seed-list">
            {uniqueRecommendationSeeds.map(seed => (
              <span className="seed-pill" key={seed}>
                {seed} 
              </span>
            ))}
          </div>

          <p className="seed-caption">
            These artists are the strongest signals in your recommendation profile.
          </p>
      </section>
      )}

      {(isLoadingRecommendations || recommendedArtists.length > 0) && (
        <section className="recommended-card">
          <h3>Recommended Artists</h3>

          {removedRecommendationMessage && (
                    <p className="recommendation-feedback-message"> 
                      {removedRecommendationMessage}
                    </p>
          )}

          {isLoadingRecommendations && (
            <p>Finding artists you might like...</p>
          )}

          {!isLoadingRecommendations && recommendationError && (
            <p>{recommendationError}</p>
          )}

          {!isLoadingRecommendations && visibleRecommendations.length > 0 && (
            <div className="recommended-list">
              {visibleRecommendations.map(recommendedArtist => (
                <div className="recommended-artist" key={recommendedArtist.name}>
                  <div className="recommended-header">
                    <div className="recommended-title">
                      {recommendedArtist.imageUrl && (
                        <img 
                          className="recommended-image"
                          src={recommendedArtist.imageUrl}
                          alt={`Image of ${recommendedArtist.name}`}
                        />
                      )}
                      <span className="recommended-name">{recommendedArtist.name}</span>
                    </div>
                    <span className="recommendation-type">
                        {recommendedArtist.recommendation_type}
                    </span>
                    <button 
                      className="recommended-score"
                      onClick={() => {
                        setOpenScoreDetails(
                          openScoreDetails === recommendedArtist.name
                            ? null
                            : recommendedArtist.name
                        )
                      }}
                    >
                      {recommendedArtist.score}% fit
                    </button>
                  </div>
                  <p>{recommendedArtist.reason}</p>
                  {recommendedArtist.signals.length > 0 && (
                    <div className="recommended-signals">
                      {recommendedArtist.signals.map(signal => (
                        <span className="recommended-signal" key={signal}>
                          {signal}
                        </span>
                      ))}
                    </div>
                  )}
                  {recommendedArtist.score_factors.length > 0 && openScoreDetails === recommendedArtist.name && (
                    <div className="score-factors">
                      <div className="score-factors-title">Fit factors</div>
                      <div className="score-factors-note">
                        Base 60 plus selected matching signals.
                      </div>

                      {recommendedArtist.score_factors.slice(0, 3).map(factor => (
                        <span className="score-factor" key={factor.label}>
                          <span>{factor.label}</span> 
                          <span>+{factor.points}</span>
                        </span>
                      ))}

                      <div className="recommendation-feedback">
                        <p className="recommendation-feedback-label">Was this useful?</p>

                        <div className="recommendation-feedback-options">
                          <button className={
                              recommendationFeedback[recommendedArtist.name] === "good_fit"
                                ? "recommendation-feedback-button selected"
                                : "recommendation-feedback-button"
                            }
                            onClick={() => {
                            setRecommendationFeedback({
                              ...recommendationFeedback,
                              [recommendedArtist.name]: "good_fit"
                            })
                          }}>Good fit </button>
                          <button className={
                              recommendationFeedback[recommendedArtist.name] === "already_know"
                                ? "recommendation-feedback-button selected"
                                : "recommendation-feedback-button"
                            }
                            onClick={() => {
                            setRecommendationFeedback({
                              ...recommendationFeedback,
                              [recommendedArtist.name]: "already_know"
                            })
                          }}>Already know</button>
                          <button className={
                              recommendationFeedback[recommendedArtist.name] === "not_for_me"
                                ? "recommendation-feedback-button selected"
                                : "recommendation-feedback-button"
                            }
                            onClick={() => {
                            setRecommendationFeedback({
                              ...recommendationFeedback,
                              [recommendedArtist.name]: "not_for_me"
                            })
                            setRemovedRecommendationMessage(`Removed ${recommendedArtist.name} from recommendations`)
                          }}>Not for me</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <a
                    className="recommended-link"
                    href={recommendedArtist.spotifyUrl ?? getSpotifySearchUrl(recommendedArtist.name)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Spotify
                  </a>
                </div>
              ))}
            </div>
          )}
          {!isLoadingRecommendations && (recommendedArtists.length > 0 && visibleRecommendations.length === 0) && (
            <p>You’ve hidden all current recommendations. Try another time range or clear your feedback to see more.</p>
          )}
        </section>
      )}

      {!accessToken && (
        <p className="connect-spotify">Connect Spotify to generate your music profile.</p>
      )}

      {accessToken && topTracks.length > 0 && topArtists.length > 0 && (
        <div className="taste-grid">
          <section>
            <h3>Top Tracks</h3>

            <ol>
              {topTracks.map((track, index) => (
                <li className="track-row" key={track.id}>
                  <span className="track-rank">{index + 1}</span>
                  <img className="album-cover" src={track.album.images[2].url} alt={`${track.name} album cover`}/>
                  <div className="track-info">
                    <span className="track-title">{track.name}</span>
                    <span className="track-artist">{track.artists[0].name}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3>Top Artists</h3>

            <ol>
              {topArtists.map((artist, index) => (
                <li className="artist-row" key={artist.id}>
                  <span className="artist-rank">{index + 1}</span>
                  <img className="artist-image" src={artist.images[2].url} alt={`Image of ${artist.name}`}/>
                  <span className="artist-name">{artist.name}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}

    </main>
  )
}

export default App
