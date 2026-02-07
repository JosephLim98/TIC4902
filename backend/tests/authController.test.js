import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// Mock the service
const mockRegisterService = jest.fn();
const mockLoginService = jest.fn();

jest.unstable_mockModule("../service/authService.js", () => ({
  registerService: mockRegisterService,
  loginService: mockLoginService,
}));

// Import after mocking
const { registerUser, loginUser } = await import(
  "../controller/authController.js"
);

describe("Auth Controller Tests", () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("registerUser", () => {
    it("should return 201 with user data on successful registration", async () => {
      const mockUser = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        created_at: new Date(),
      };

      mockReq.body = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      };

      mockRegisterService.mockResolvedValueOnce(mockUser);

      await registerUser(mockReq, mockRes);

      expect(mockRegisterService).toHaveBeenCalledWith(
        "testuser",
        "test@example.com",
        "password123"
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 201,
        message: "User created successfully",
        data: mockUser,
      });
    });

    it("should return 400 when validation fails", async () => {
      const error = new Error("Invalid email format");
      error.status = 400;

      mockReq.body = {
        username: "testuser",
        email: "invalid-email",
        password: "password123",
      };

      mockRegisterService.mockRejectedValueOnce(error);

      await registerUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 400,
        message: "Invalid email format",
        data: null,
      });
    });

    it("should return 409 when user already exists", async () => {
      const error = new Error(
        "User with this email or username already exists"
      );
      error.status = 409;

      mockReq.body = {
        username: "existinguser",
        email: "existing@example.com",
        password: "password123",
      };

      mockRegisterService.mockRejectedValueOnce(error);

      await registerUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 409,
        message: "User with this email or username already exists",
        data: null,
      });
    });

    it("should return 500 on internal server error", async () => {
      const error = new Error("Database error");

      mockReq.body = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      };

      mockRegisterService.mockRejectedValueOnce(error);

      await registerUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 500,
        message: "Internal server error during registration",
        data: null,
      });
    });
  });

  describe("loginUser", () => {
    it("should return 201 with user data and token on successful login", async () => {
      const mockResult = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        token: "jwt.token.here",
      };

      mockReq.body = {
        email: "test@example.com",
        password: "password123",
      };

      mockLoginService.mockResolvedValueOnce(mockResult);

      await loginUser(mockReq, mockRes);

      expect(mockLoginService).toHaveBeenCalledWith(
        "test@example.com",
        "password123"
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 201,
        message: "User logged in successfully",
        data: mockResult,
      });
    });

    it("should return 400 when email is missing", async () => {
      mockReq.body = {
        password: "password123",
      };

      await loginUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 400,
        message: "Missing email or password",
        data: null,
      });
      expect(mockLoginService).not.toHaveBeenCalled();
    });

    it("should return 400 when password is missing", async () => {
      mockReq.body = {
        email: "test@example.com",
      };

      await loginUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 400,
        message: "Missing email or password",
        data: null,
      });
      expect(mockLoginService).not.toHaveBeenCalled();
    });

    it("should return 409 when credentials are invalid", async () => {
      const error = new Error("Invalid Credential!");
      error.status = 409;

      mockReq.body = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      mockLoginService.mockRejectedValueOnce(error);

      await loginUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 409,
        message: "Invalid Credential!",
        data: null,
      });
    });

    it("should return 500 on internal server error", async () => {
      const error = new Error("Database error");

      mockReq.body = {
        email: "test@example.com",
        password: "password123",
      };

      mockLoginService.mockRejectedValueOnce(error);

      await loginUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 500,
        message: "Internal server error during login",
        data: null,
      });
    });
  });
});
