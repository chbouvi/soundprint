import { useEffect, useState } from 'react'
import './App.css'


type ArtistImage = {
  url: string
}

type Artist = {
  id: string
  name: string
  images: ArtistImage[]
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

  const artistNames = topTracks.map(track => track.artists[0].name)
  const uniqueArtists = new Set(artistNames)
  const uniqueArtistCount = uniqueArtists.size

  const artistCounts: Record<string, number> = {}

  topTracks.forEach(track => {
    const artistName = track.artists[0].name

    if (artistCounts[artistName]) {
      artistCounts[artistName] += 1
    } else {
      artistCounts[artistName] = 1
    }
  })

  let mostRepeatedArtist = ""
  let mostRepeatedArtistCount = 0

  Object.entries(artistCounts).forEach(([artistName, count]) => {
    if (count > mostRepeatedArtistCount) {
      mostRepeatedArtist = artistName
      mostRepeatedArtistCount = count
    }
  })

  

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
      
      {accessToken && (
      <section className="stats-panel">
        <div className="stat-card">
          <span className="stat-label">Unique Artists</span>
          <strong>{uniqueArtistCount}</strong>
          <span className="stat-caption">across your top tracks</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Most Repeated Artist</span>
          <strong>{mostRepeatedArtist}</strong>
          <span className="stat-caption">appears in {mostRepeatedArtistCount} top tracks</span>
        </div>
      </section>
      )}

      {topTracks.length === 0 && topArtists.length === 0 ? (
        <p>Connect Spotify to generate your music profile.</p>
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
