import bcrypt from 'bcrypt';
import pool from '../config/db.js';

// Get a user's public profile by ID
export async function getUserProfile(userId) {
    const result = await pool.query(
        `SELECT id, username, email, created_at, updated_at FROM users WHERE id = $1`, 
        [userId]
    );

    if (result.rows.length === 0) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    return result.rows[0];
}

// Update a user's username and/or email
export async function updateUserProfile(userId, { username, email }) {
    if (!username && !email) {
        const err = new Error('At least one field (username or email) is required');
        err.status = 400;
        throw err;
    }

    // Validate email format if provided
    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            const err = new Error('Invalid email format');
            err.status = 400;
            throw err;
        }
    }

    // CHeck uniqueness against other users
    if (username || email) {
        const conflict = await pool.query(
            `SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3`,
            [ username || '',
              email || '',
              userId
            ]
        );

        if (conflict.rows.length > 0) {
            const err = new Error('Username or email is already taken');
            err.status = 409;
            throw err;
        }
    }

    const result = await pool.query(
        `UPDATE users 
            SET username = COALESCE($1, username), email = COALESCE($2, email), updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING id, username, email, created_at, updated_at`,
        [username || null, email || null, userId]
    );

    return result.rows[0];

}

// Change a user's password after verifying the user
export async function changeUserPassword(userId, { currentPassword, newPassword }) {
    if (!currentPassword || !newPassword) {
        const err = new Error('Current password and new password are required');
        err.status = 400;
        throw err;
    }

    if (newPassword.length < 6) {
        const err = new Error('New password must be at least 6 characters long');
        err.status = 400;
        throw err;
    }

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
        const err = new Error('User not foudn');
        err.status = 404;
        throw err;
    }

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

    if (!isMatch) {
        const err = new Error('Current password is incorrect');
        err.status = 401;
        throw err;
    }

    const saltRounds = 10;
    const newHash = await bcrypt.hash(newPassword, saltRounds);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, userId]);

    return { message: 'Password updated successfully' };
}

// Delete a user account after verifying their password
export async function deleteUserAccount(userId, { password }) {
    if (!password) {
        const err = new Error('Password is required to delete account');
        err.status = 400;
        throw err;
    }

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    const isMatch = await bcrypt.compare(password, result.rows[0].password_hash);

    if (!isMatch) {
        const err = new Error('Incorrect password');
        err.status = 401;
        throw err;
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    return { message: 'Account deleted successfully' };
}
