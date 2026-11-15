import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, Inbox } from 'lucide-react';
import { useAuth } from '../context/auth.jsx';
import { Empty } from '../components/common.jsx';

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const home = user ? (user.role === 'client' ? '/client' : '/app') : '/';

  return (
    <div className="page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <Empty
          brand
          icon={Compass}
          title="This page took a wrong turn"
          text="The link may be old, or the page moved. Your inbox is exactly where you left it."
          action={
            <div className="row gap-8" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn--secondary" onClick={() => navigate(-1)}>
                <ArrowLeft size={15} /> Go back
              </button>
              <button className="btn btn--primary" onClick={() => navigate(home)}>
                <Inbox size={15} /> Open MailPilot
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
