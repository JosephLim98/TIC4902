import { loginService, registerService } from "../service/authService.js";

const handleResponse = (res, status, message, data=null) => {
    res.status(status).json({
        status,
        message,
        data,
    });
};

export const registerUser = async(req, res) => {
    try{
        const { username, email, password } = req.body;
        const newUser = await registerService(username, email, password);
        return handleResponse(res, 201, "User created successfully", newUser);
    }catch(err){
        console.error("Registration error:", err);
        const status = err.status || 500;
        return handleResponse(res,status,status === 500 ? "Internal server error during registration" : err.message);
    }
};

export const loginUser = async (req, res) => {
    try{
        const {email, password} = req.body;
        if(!email || !password) return handleResponse(res, 400, "Missing email or password");
        const result = await loginService(email, password);
        handleResponse(res, 201, "User logged in successfully", result);
    }catch(err){
        console.error("Login error:", err);
        const status = err.status || 500;
        return handleResponse(res,status,status === 500 ? "Internal server error during login" : err.message);
    }
};

