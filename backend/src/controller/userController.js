import { getUserProfile, updateUserProfile, changeUserPassword, deleteUserAccount } from "../service/userService.js";

const handleResponse = (res, status, message, data = null) => {
    res.status(status).json({ status, message, data });
};

// GET /api/users/profile
export const getProfile = async (req, res) => {
    try {
        const user = await getUserProfile(req.user.id);
        return handleResponse(res, 200, 'Profile retrieved successfully', user);
    } catch (err) {
        const status = err.status || 500;
        return handleResponse(res, status, status === 500 ? 'Internal server error' : err.message);
    }
};

// PATCH /api/users/profile
export const updateProfile = async (req, res) => {
    try {
        const { username, email } = req.body;
        const updated = await updateUserProfile(req.user.id, { username, email });
        return handleResponse(res, 200, 'Profile updated successfully', updated);
    } catch (err) {
        const status = err.status || 500;
        return handleResponse(res, status, status === 500 ? 'Internal server error' : err.message);
    }
};

// PATCH /api/users/password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const result = await changeUserPassword(req.user.id, { currentPassword, newPassword });
        return handleResponse(res, 200, result.message);
    } catch (err) {
        const status = err.status || 500;
        return handleResponse(res, status, status === 500 ? 'Internal server error' : err.message);
    }
}

// DELETE /api/users/account
export const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;
        const result = await deleteUserAccount(req.user.id, { password });
        return handleResponse(res, 200, result.message);
    } catch (err) {
        const status = err.status || 500;
        return handleResponse(res, status, status === 500 ? 'Internal server error' : err.message);
    }
}