import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Form.css";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const user = localStorage.getItem("user");
        if (user) navigate("/");
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("http://localhost:5000/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (res.ok) {
                setIsError(false);
                setMessage(`Welcome, ${data.data.username}!`);
                localStorage.setItem(
                    "user",
                    JSON.stringify({ username: data.data.username, token: data.data.token })
                );
                navigate("/");
            } else {
                setIsError(true);
                setMessage(data.message || "Login failed. Please try again.");
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
                <h2 className="card-title">Login</h2>

                <form onSubmit={handleLogin}>
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
                    <button type="submit">Login</button>
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

export default LoginPage;
