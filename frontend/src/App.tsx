import { useEffect, useState } from 'react'
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

  const base64encode = (input: any) => {
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

  const [topTracks, setTopTracks] = useState<Track[]>([])

  useEffect(() => {
    if (accessToken) {
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
    }
  }, [accessToken, timeRange])

  const [topArtists, setTopArtists] = useState<Artist[]>([])

  useEffect(() => {
    if (accessToken) {
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
    }
  }, [accessToken, timeRange])

  const genreNames = topArtists.flatMap(artist => artist.genres ?? [])
  const uniqueGenres = new Set(genreNames)
  const uniqueGenreCount = uniqueGenres.size

  const [tasteAnalysis, setTasteAnalysis] = useState<TasteAnalysis | null>(null)
  const [tasteSummary, setTasteSummary] = useState("")
  const [tasteSummarySource, setTasteSummarySource] = useState("")
  const [tasteSummaryFallbackReason, setTasteSummaryFallbackReason] = useState("")
  const [isTasteSummaryLoading, setIsTasteSummaryLoading] = useState(false)
  const maxArtistCount = tasteAnalysis && tasteAnalysis.artist_frequency.length > 0
    ? Math.max(...tasteAnalysis.artist_frequency.map(artist => artist.count))
    : 0

  useEffect(() => {
    setTasteAnalysis(null)
    setTasteSummary("")
    setTasteSummarySource("")
    setTasteSummaryFallbackReason("")
  }, [timeRange])

  useEffect(() => {
    if (accessToken && topTracks.length > 0 && topArtists.length > 0) {
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
    }
  }, [accessToken, topTracks, topArtists])

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
          artist_frequency: tasteAnalysis.artist_frequency
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.summary) {
            setTasteSummary(data.summary)
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
    tasteAnalysis?.artist_frequency
  ])


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
      </section>
      )}

      {accessToken && tasteAnalysis && (
        <section className="chart-card">
          <h3>Artist Frequency in Top Tracks</h3>

          {tasteAnalysis.artist_frequency.map(artist => {
            const barWidth = maxArtistCount > 0 ? (artist.count / maxArtistCount) * 100 : 0

            return (
              <div className="bar-row" key={artist.artist_name}>
                <div className="bar-header">
                  <span>{artist.artist_name}</span>
                  <span>{artist.count}</span>
                </div>

                <div className="bar-track">
                  <div className="bar-fill" style={{width: `${barWidth}%` }}></div>
                </div>
              </div>
            )
          })}
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

      {topTracks.length === 0 && topArtists.length === 0 ? (
        <p className="connect-spotify">Connect Spotify to generate your music profile.</p>
      ) : (
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
