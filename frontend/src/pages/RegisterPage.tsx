import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Form.css";

const RegisterPage = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [localError, setLocalError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const { register, isAuthenticated, isLoading, error, clearError } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/");
        }
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        if (error || localError) {
            const timer = setTimeout(() => {
                clearError();
                setLocalError("");
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [error, localError, clearError]);

    const validateForm = (): boolean => {
        setLocalError("");

        if (username.length < 3) {
            setLocalError("Username must be at least 3 characters long.");
            return false;
        }

        if (password.length < 6) {
            setLocalError("Password must be at least 6 characters long.");
            return false;
        }

        if (password !== confirmPassword) {
            setLocalError("Passwords do not match.");
            return false;
        }

        return true;
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setLocalError("");
        setSuccessMessage("");
        
        if (!validateForm()) {
            return;
        }

        try {
            await register(username, email, password);
            setSuccessMessage("Registration successful! Redirecting to login...");

            setTimeout(() => {
                navigate("/login");
            }, 2000);
            
        } catch (err) {
            console.error('Registration error: ', err);
        }
    };

    const displayError = localError || error;

    return (
        <div className="full-height-center form">
            <div className="form-card">
                <h2 className="card-title">Create Account</h2>
                <p className="card-subtitle">Sign up to get started</p>

                <form onSubmit={handleRegister}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input 
                            id="username" 
                            type="text" 
                            placeholder="johndoe"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                setLocalError("");
                                clearError();
                            }}
                            required
                            autoComplete="username"
                            disabled={isLoading}
                            minLength={3}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>

                        <input 
                            id="email" 
                            type="email" 
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setLocalError("");
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
                                    setLocalError("");
                                    clearError();
                                }}
                                required
                                autoComplete="new-password"
                                disabled={isLoading}
                                minLength={6}
                            />
                            
                            <button type="button" className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                <span className="material-symbols-outlined">
                                    {showPassword ? "visibility_off" : "visibility"}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <div className="password-input-wrapper">
                            <input
                                id="confirmPassword"
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Re-enter your password"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setLocalError("");
                                    clearError();
                                }}
                                required
                                autoComplete="new-password"
                                disabled={isLoading}
                            />

                            <button type="button" className="password-toggle"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                tabIndex={-1}
                            >
                                <span className="material-symbols-outlined">
                                    {showPassword ? "visibility_off" : "visibility"}
                                </span>
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading} className="btn-primary">
                        {isLoading ? (
                            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: '0.5rem' }}>
                                <LoadingSpinner size="small" />
                                Creating account...
                            </span>
                        ) : (
                            'Sign Up'
                        )}
                    </button>
                </form>

                {displayError && (
                    <div className="message message-error">
                        <strong>Error:</strong> {displayError}
                    </div>
                )}

                {successMessage && (
                    <div className="message message-success">
                        {successMessage}
                    </div>
                )}

                <div className="divider">
                    <span>or</span>
                </div>

                <p className="footer-text">
                    Already have an account?{" "}
                    <Link to="/login" className="link-text">Sign in</Link>
                </p>

            </div>
        </div>
    );
};

export default RegisterPage;
