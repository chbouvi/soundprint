import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState("Checking backend...")

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/health")
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(error => setMessage("Error connecting to backend"))
  }, [])

  return (
    <main>
      <h1>SoundPrint</h1>
      <p>Backend status: {message}</p>
    </main>
  )
}

export default App
