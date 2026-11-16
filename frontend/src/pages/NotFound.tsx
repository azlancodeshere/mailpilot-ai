import { Link } from "react-router-dom"
import { Compass } from "lucide-react"
import { Button, Logo } from "../components/ui"

export default function NotFound() {
  return (
    <div className="notfound">
      <Logo size={34} />
      <span className="notfound-code">404</span>
      <h1>This page drifted out of the inbox</h1>
      <p>The link you followed doesn't exist — or it was archived.</p>
      <div className="state-actions">
        <Link to="/app" className="btn btn-primary">
          <Compass size={15} />
          Back to dashboard
        </Link>
        <Link to="/" className="btn btn-ghost">
          Go home
        </Link>
      </div>
      <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
        ← Go back
      </Button>
    </div>
  )
}
