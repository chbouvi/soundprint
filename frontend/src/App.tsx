import { useEffect, useState } from 'react'
import './App.css'

type Artist = {
  id: string
  name: string
}
type Track = {
  id: string
  name: string
  artists: Artist[]
}

function App() {
  const [message, setMessage] = useState("Checking backend...")

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/health")
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage("Error connecting to backend"))
  }, [])

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
      fetch("https://api.spotify.com/v1/me/top/tracks?limit=10", {
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
  }, [accessToken])

  const [topArtists, setTopArtists] = useState<Artist[]>([])

  useEffect(() => {
    if (accessToken) {
      fetch("https://api.spotify.com/v1/me/top/artists?limit=10", {
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
  }, [accessToken])

  return (
    <main>
      <h1>SoundPrint</h1>

      <button onClick={handleConnectSpotify}>
        Connect Spotify
      </button>

      <p>
        Backend status: {message}
      </p>

      {errorMessage && (
        <p>Error: {errorMessage}</p>
      )}

      <h3>
        Top Tracks
      </h3>

      <ul>
        {topTracks.map(track => (
          <li key={track.id}>
            {track.name} by {track.artists[0].name}
          </li>
        ))}
      </ul>

      <h3>
        Top Artists
      </h3>
      
      <ul>
        {topArtists.map(artist => (
          <li key={artist.id}>
            {artist.name}
          </li>
        ))}
      </ul>

    </main>
  )
}

export default App
