import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export function generateToken(user) {
    return jwt.sign({user}, process.env.JWT_SECRET, {
        expiresIn: "15m",
    });
}

export async function registerService(username, email, password) {
    if (!username || !email || !password) {
        const err = new Error("Username, email, and password are required");
        err.status = 400;
        throw err;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        const err = new Error("Invalid email format");
        err.status = 400;
        throw err;
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
        const err = new Error("Password must be at least 6 characters long");
        err.status = 400;
        throw err;
    }

    const userCheck = await pool.query(
        "SELECT id FROM users WHERE email = $1 OR username = $2",
        [email, username]
      );

    if (userCheck.rows.length > 0) {
        const err = new Error("User with this email or username already exists");
        err.status = 409;
        throw err;
    }
  
      // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
  
      // Insert new user
    const result = await pool.query(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at",
        [username, email, passwordHash]
    );
      
    const newUser = result.rows[0];
    return {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        created_at: newUser.created_at,
    };


}


export async function loginService(email, password) {
    //check if username exist, if yes, proceed further
    const userCheck = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
    
    if(userCheck.rows.length === 0){
        const err = new Error("Invalid Credential!");
        err.status = 409;
        throw err;
    }   

    const user = userCheck.rows[0]
    const result = await bcrypt.compare(password, user.password_hash);

    if(!result) {
        const err = new Error("Invalid Credential!");
        err.status = 409;
        throw err;
    }

    const token = generateToken(user);
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        token: token,
    };

}

