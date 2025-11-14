import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Form.css";

const RegisterPage = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res = await fetch("http://localhost:5000/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await res.json();

            if (res.ok) {
                setIsError(false);
                setMessage("Registration successful! Redirecting to login...");
                setTimeout(() => {
                    navigate("/login");
                }, 1500);
            } else {
                setIsError(true);
                setMessage(data.message || "Registration failed. Please try again.");
            }
        } catch (err) {
            console.error(err);
            setIsError(true);
            setMessage("Something went wrong. Please try again.");
        }
    };

    return (
        <div className="full-height-center">
            <div className="form-card">
                <h2 className="card-title">Register</h2>

                <form onSubmit={handleRegister}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            setMessage("");
                        }}
                        required
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setMessage("");
                        }}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setMessage("");
                        }}
                        required
                    />
                    <button type="submit">Register</button>

                </form>

                {message && (
                    <div className={`message ${isError ? "message-error" : "message-success"}`}>
                        {message}
                    </div>
                )}

            </div>
        </div>
    );
};

export default RegisterPage;
