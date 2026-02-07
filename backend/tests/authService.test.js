import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// Mock dependencies
const mockPool = {
  query: jest.fn(),
};

const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
};

const mockJwt = {
  sign: jest.fn(),
};

// Mock modules before importing
jest.unstable_mockModule("../config/db.js", () => ({
  default: mockPool,
}));

jest.unstable_mockModule("bcrypt", () => ({
  default: mockBcrypt,
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: mockJwt,
}));

// Import after mocking
const { generateToken, registerService, loginService } = await import(
  "../service/authService.js"
);

describe("Auth Service Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  describe("generateToken", () => {
    it("should generate a JWT token with user data", () => {
      const user = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
      };
      const mockToken = "mock.jwt.token";

      mockJwt.sign.mockReturnValue(mockToken);

      const result = generateToken(user);

      expect(mockJwt.sign).toHaveBeenCalledWith({ user }, "test-secret", {
        expiresIn: "15m",
      });
      expect(result).toBe(mockToken);
    });
  });

  describe("registerService", () => {
    it("should throw error when username is missing", async () => {
      await expect(
        registerService(null, "test@example.com", "password123")
      ).rejects.toThrow("Username, email, and password are required");

      const error = await registerService(
        null,
        "test@example.com",
        "password123"
      ).catch((e) => e);
      expect(error.status).toBe(400);
    });

    it("should throw error when email is missing", async () => {
      await expect(
        registerService("testuser", null, "password123")
      ).rejects.toThrow("Username, email, and password are required");

      const error = await registerService(
        "testuser",
        null,
        "password123"
      ).catch((e) => e);
      expect(error.status).toBe(400);
    });

    it("should throw error when password is missing", async () => {
      await expect(
        registerService("testuser", "test@example.com", null)
      ).rejects.toThrow("Username, email, and password are required");

      const error = await registerService(
        "testuser",
        "test@example.com",
        null
      ).catch((e) => e);
      expect(error.status).toBe(400);
    });

    it("should throw error for invalid email format", async () => {
      await expect(
        registerService("testuser", "invalid-email", "password123")
      ).rejects.toThrow("Invalid email format");

      const error = await registerService(
        "testuser",
        "invalid-email",
        "password123"
      ).catch((e) => e);
      expect(error.status).toBe(400);
    });

    it("should throw error for password less than 6 characters", async () => {
      await expect(
        registerService("testuser", "test@example.com", "12345")
      ).rejects.toThrow("Password must be at least 6 characters long");

      const error = await registerService(
        "testuser",
        "test@example.com",
        "12345"
      ).catch((e) => e);
      expect(error.status).toBe(400);
    });

    it("should throw error when user with email already exists", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      try {
        await registerService("newuser", "existing@example.com", "password123");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe(
          "User with this email or username already exists"
        );
        expect(error.status).toBe(409);
      }
    });

    it("should throw error when user with username already exists", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      try {
        await registerService("existinguser", "new@example.com", "password123");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe(
          "User with this email or username already exists"
        );
        expect(error.status).toBe(409);
      }
    });

    it("should successfully register a new user and return user data", async () => {
      const mockUser = {
        id: 1,
        username: "newuser",
        email: "newuser@example.com",
        created_at: new Date("2024-01-01"),
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // User check - no existing user
        .mockResolvedValueOnce({ rows: [mockUser] }); // Insert user

      mockBcrypt.hash.mockResolvedValue("hashed-password");

      const result = await registerService(
        "newuser",
        "newuser@example.com",
        "password123"
      );

      expect(mockBcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        created_at: mockUser.created_at,
      });
      expect(result.password_hash).toBeUndefined();
    });
  });

  describe("loginService", () => {
    it("should throw error when user does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      try {
        await loginService("nonexistent@example.com", "password123");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe("Invalid Credential!");
        expect(error.status).toBe(409);
      }
    });

    it("should throw error when password is incorrect", async () => {
      const mockUser = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        password_hash: "hashed-password",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockBcrypt.compare.mockResolvedValueOnce(false);

      try {
        await loginService("test@example.com", "wrongpassword");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe("Invalid Credential!");
        expect(error.status).toBe(409);
      }
    });

    it("should successfully login and return user data with JWT token", async () => {
      const mockUser = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        password_hash: "hashed-password",
      };
      const mockToken = "jwt.token.here";

      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockBcrypt.compare.mockResolvedValueOnce(true);
      mockJwt.sign.mockReturnValueOnce(mockToken);

      const result = await loginService("test@example.com", "password123");

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        "password123",
        "hashed-password"
      );
      expect(mockJwt.sign).toHaveBeenCalled();
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        token: mockToken,
      });
    });
  });
});
