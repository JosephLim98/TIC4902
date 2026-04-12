import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Form.css";
import showIcon from "../assets/show.png";
import hideIcon from "../assets/hide.png";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    // const [message, setMessage] = useState("");
    // const [isError, setIsError] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated, isLoading, error, clearError } = useAuth();

    // Get the page the user was trying to visit before being redirected
    // const from = (location.state as any)?.from?.pathname || "/";

    interface LocationState {
        from?: {
            pathname: string;
        }
    }

    const from = (location.state as LocationState)?.from?.pathname || "/";

    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, from]);

    useEffect(() => {
        // Clear error when component unmounts
        return () => clearError();
    }, [clearError]);

    // TODO: if the user manually changes the url to a page that the user is not supposed to access, show 404 page not found or smth liddat
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        try {
            await login(email, password, rememberMe);
            // Navigation will happen automatically via useEffect
        } catch (err) {
            // Error is handled by AuthContext
            console.error('Login error: ', err);
        }
    };

    return (
        <div className="full-height-center form">
            <div className="form-card">
                <h2 className="card-title">Login</h2>
                {/* <h2 className="card-title">Welcome Back</h2> */}
                <p className="card-subtitle">Sign in to your account</p>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>

                        <input 
                            id="email" 
                            type="email" 
                            placeholder="you@example.com" 
                            value={email} 
                            onChange={(e) => {
                                setEmail(e.target.value);
                                clearError();
                            }} 
                            required 
                            autoComplete="email"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <div className="password-input-wrapper">
                            <input 
                                id="password" 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Enter your password" 
                                value={password} 
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    clearError();
                                }} 
                                required 
                                autoComplete="current-password"
                                disabled={isLoading}
                            />

                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                <img
                                    src={showPassword ? hideIcon : showIcon}
                                    alt={showPassword ? "Hide password" : "Show password"}
                                    style={{ width: '20px', height: '20px' }}
                                />
                            </button>
                        </div>
                    </div>

                    <div className="form-row">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                disabled={isLoading}
                            />
                            <span>Remember Me</span>
                        </label>
                        <a href="#" className="link-text">Forgot Password?</a>
                    </div>

                    <button type="submit" disabled={isLoading} className="btn-primary">
                        {isLoading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
                                <LoadingSpinner size="small" />
                                Signing in...
                            </span>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                {error && (
                    <div className="message message-error">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                <div className="divider">
                    <span>or</span>
                </div>

                <p className="footer-text">
                    Don't have an account?{" "}
                    <Link to="/register" className="link-text">Sign up</Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
