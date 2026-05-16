// src/App.tsx
import { useEffect, useState } from 'react'
import Desktop from './components/Desktop/Desktop'
import { boot } from './kernel/boot'

export default function App() {
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    boot().then(() => setBooted(true))
  }, [])

  if (!booted) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#64748b',
        fontSize: 14, fontFamily: 'system-ui'
      }}>
        Initializing filesystem...
      </div>
    )
  }

  return <Desktop />
}