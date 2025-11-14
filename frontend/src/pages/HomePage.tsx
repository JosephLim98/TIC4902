import React from "react";
import { useNavigate } from "react-router-dom";

const HomePage = () => {
    const navigate = useNavigate();

    const user = localStorage.getItem("user");
    const parsedUser = user ? JSON.parse(user) : null;

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("jwtToken");
        navigate("/login");
    };

    return (
        <div style={{ maxWidth: "400px", margin: "2rem auto", textAlign: "center" }}>
            {parsedUser ? (
                <>
                    <p>Hello, {parsedUser.username}!</p>
                    <button
                        onClick={handleLogout}
                        style={{
                            padding: "0.5rem 1rem",
                            marginTop: "1rem",
                            cursor: "pointer",
                        }}
                    >
                        Logout
                    </button>
                </>
            ) : (
                <h2>
                    Welcome! Please <a href="/login">login</a> or <a href="/register">register</a>.
                </h2>
            )}
        </div>
    );
};

export default HomePage;
