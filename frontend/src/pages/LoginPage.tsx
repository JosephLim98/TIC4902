import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Spinner } from "../components/Spinner";
import "../styles/Form.css";
import { MaterialIcon } from "@/components/MaterialIcon";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState("");
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
        if (error || localError) {
            const timer = setTimeout(() => {
                clearError();
                setLocalError("");
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [error, localError, clearError]);

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

                            <button type="button" className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                <MaterialIcon name={showPassword ? "visibility_off" : "visibility"} />
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
                        {/* <a href="#" className="link-text">Forgot Password?</a> */}
                    </div>

                    <button type="submit" disabled={isLoading} className="btn-primary">
                        {isLoading ? (
                            <Spinner message="Signing in..." light />
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
