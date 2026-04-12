import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "../styles/HomePage.css";
import runningIcon from "../assets/running.png";
// import skippedIcon from "../assets/skipped.png";
import failedIcon from "../assets/failed.png";

const HomePage = () => {
    const navigate = useNavigate();
    const { user, logout, isAuthenticated } = useAuth();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    if (!isAuthenticated || !user) {
        return (
            <div className="home-container">
                <div className="welcome-card">
                    <h1>Welcome to Flink Platform</h1>
                    <p className="subtitle">Manage your Apache Flink streaming pipelines</p>

                    <div className="action-buttons">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="btn-primary"
                        >
                            Sign In
                        </button>

                        <button
                            onClick={() => navigate("/register")}
                            className="btn-secondary"
                        >
                            Sign Up
                        </button>
                    </div>
                    
                    <div className="features">
                        <div className="feature">
                            <span className="feature-icon">🚀</span>
                            <h3>Fast Deployment</h3>
                            <p>Deploy Flink Pipeline in Seconds</p>
                        </div>
                        <div className="feature">
                            <span className="feature-icon">📊</span>
                            <h3>Real-time Monitoring</h3>
                            <p>Track Metrics and Performances Live</p>
                        </div>
                        <div className="feature">
                            <span className="feature-icon">⚙️</span>
                            <h3>Easy Management</h3>
                            <p>Control all your pipelines from one place</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="home-container">
            <div className="dashboard-preview">
                <div className="user-header">
                    <div className="user-info">
                        <div className="avatar">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2>Welcome back, {user.username}!</h2>
                            <p className="user-email">{user.email}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="btn-logout">
                        Logout
                    </button>
                </div>

                <div className="quick-stats">
                    <div className="stat-card">
                        <span className="stat-icon">📈</span>
                        <h3>4</h3>
                        <p>Active Pipelines</p>
                    </div>
                    <div className="stat-card">
                        {/* <span className="stat-icon">✅</span> */}
                        <div className="stat-icon-container">
                            <img 
                                src={runningIcon} 
                                alt="Running" 
                                className="stat-icon-img" 
                            />
                        </div>
                        <h3>2</h3>
                        <p>Running</p>
                    </div>
                    <div className="stat-card">
                        <span className="stat-icon">⚠️</span>
                        <h3>1</h3>
                        <p>Stopped</p>
                    </div>
                    <div className="stat-card">
                        {/* <span className="stat-icon">❌</span> */}
                        <div className="stat-icon-container">
                            <img 
                                src={failedIcon} 
                                alt="Failed" 
                                className="stat-icon-img" 
                            />
                        </div>
                        <h3>1</h3>
                        <p>Failed</p>
                    </div>
                </div>

                <div className="cta-section">
                    <h3>Ready to manage your pipelines?</h3>
                    <p>Access the full dashboard to view, create, and manage your Flink pipelines</p>
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="btn-primary btn-large"
                        >
                        Go to Dashboard →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
