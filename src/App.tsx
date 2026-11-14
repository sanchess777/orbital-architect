import { useRoom } from './multiplayer/useRoom'

export default function App() {
  const code = new URLSearchParams(location.search).get('room')
  const { room, patch } = useRoom(code)

  if (!code) {
    return <p className="p-8 text-white">Додайте ?room=TEST1 до адреси</p>
  }

  const counter: number = room?.counter ?? 0

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="text-3xl font-bold text-cyan-400">Кімната {code}</h1>
      <p className="my-4 text-2xl">Лічильник: {counter}</p>
      <button
        className="rounded bg-cyan-600 px-4 py-2"
        onClick={() => patch({ counter: counter + 1 })}
      >
        +1
      </button>
    </div>
  )
}