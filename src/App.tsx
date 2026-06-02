import VenationScene from './venation/VenationScene'

export default function App() {
  // Full-viewport, no chrome. The scene paints its own pure-black background.
  return (
    <div className="fixed inset-0 h-full w-full bg-black">
      <VenationScene />
    </div>
  )
}
