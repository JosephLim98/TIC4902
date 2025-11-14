import React from "react";
import { useNavigate } from "react-router-dom"; // for navigation

const HomePage = () => {
    const navigate = useNavigate(); // hook for programmatic navigation

    const user = localStorage.getItem("user");
    const parsedUser = user ? JSON.parse(user) : null;

    // Logout function
    const handleLogout = () => {
        // Remove user info or JWT from localStorage
        localStorage.removeItem("user");
        // Optionally remove JWT if stored separately
        localStorage.removeItem("jwtToken");

        // Redirect to login page
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
