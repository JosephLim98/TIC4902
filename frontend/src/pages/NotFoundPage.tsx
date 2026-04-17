import { Link } from 'react-router-dom'
import '../styles/NotFoundPage.css'
import { MaterialIcon } from '@/components/MaterialIcon'

export default function NotFoundPage() {
    return (
        <div className="not-found-page">
            <div className="background-elements">
                <div className="floating-orb top-right" />
                <div className="floating-orb bottom-left delay-1000" />
                <div className="spinning-orb" />
            </div>

            <div className="content">
                <div className="error-code">
                    <div className="error-number">
                        <span className="glitch" data-text="404">404</span>
                    </div>
                </div>

                <h1 className="title">Page Not Found</h1>

                <p className="description">
                    The deployment you're looking for has{' '}
                    <span className="highlight">vanished</span>{' '}
                    into the digital ether.
                </p>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-header">
                            <MaterialIcon name="rocket_launch" size={24} className="icon-wrapper" />
                            <span className="stat-label">Status</span>
                        </div>
                        <div className="stat-value">LOST_IN_SPACE</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-header">
                            <MaterialIcon name="warning" size={24} className="icon-wrapper" />
                            <span className="stat-label">Error Code</span>
                        </div>
                        <div className="stat-value">404</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-header">
                            <MaterialIcon name="alarm" size={24} className="icon-wrapper" />
                            <span className="stat-label">ETA</span>
                        </div>
                        <div className="stat-value">{"\u221E"} seconds</div>
                    </div>
                </div>

                <div className="action-buttons">
                    <Link to="/" className="primary-button">
                        <MaterialIcon name="dashboard" size={20}/> 
                        <span>Back to Dashboard</span>
                    </Link>

                    <button onClick={() => window.history.back()} className="secondary-button">
                        <MaterialIcon name="arrow_back" size={20}/> 
                        <span>Go Back</span>
                    </button>
                </div>

                <div className="easter-egg">
                    <MaterialIcon name="lightbulb" size={18}/> 
                    <span>Pro tip: Check the URL or </span>
                    <span className="support-link">contact support</span>
                </div>
            </div>
        </div>
    )
}