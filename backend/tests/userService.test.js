import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockQuery = jest.fn();

jest.unstable_mockModule("../src/config/db.js", () => ({
    default: { query: mockQuery },
}));

const mockCompare = jest.fn();
const mockHash = jest.fn();

jest.unstable_mockModule("bcrypt", () => ({
    default: { compare: mockCompare, hash: mockHash },
}));

const { getUserProfile, updateUserProfile, changeUserPassword, deleteUserAccount } = await import("../src/service/userService.js");

describe("User Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("getUserProfile", () => {
        it("returns the user row when found", async () => {
            const row = {
                id: 1,
                username: "johndoe",
                email: "johndoe@gmail.com"
            };

            mockQuery.mockResolvedValueOnce({ rows: [row] });

            const result = await getUserProfile(1);

            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE id = $1"), [1]);
            expect(result).toEqual(row);
        });

        it("throws a 404 when the user does not exist", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await expect(getUserProfile(999)).rejects.toMatchObject({
                status: 404,
                message: "User not found",
            });
        });
    });


    describe("updateUserProfile", () => {
        it("throws a 400 when neither username nor email is provided", async () => {
            await expect(updateUserProfile(1, {})).rejects.toMatchObject({ status: 400 });
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it("throws a 400 for an invalid email format", async () => {
            await expect(
                updateUserProfile(1, { email: "not-an-email" })
            ).rejects.toMatchObject({ status: 400, message: "Invalid email format" });
        });

        it("throws a 409 when username/email is already taken by another user", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 2 }] });

            await expect(
                updateUserProfile(1, { username: "taken" })
            ).rejects.toMatchObject({ status: 409 });

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("id !="), ["taken", "", 1]
            );
        });

        it("updates and returns the user when validation passes", async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] })        // uniqueness check
                .mockResolvedValueOnce({        // update
                    rows: [{ id: 1, username: "newname", email: "new@example.com" }],
                });

            const result = await updateUserProfile(1, { username: "newname", email: "new@example.com" });

            expect(result).toEqual({ id: 1, username: "newname", email: "new@example.com" });
            expect(mockQuery).toHaveBeenLastCalledWith(
                expect.stringContaining("UPDATE users"),
                ["newname", "new@example.com", 1]
            );
        });

        it("updates only the username when email is omitted", async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] })       // uniqueness
                .mockResolvedValueOnce({ rows: [{ id: 1, username: "newname", email: "old@example.com" }] });

            await updateUserProfile(1, { username: "newname" });

            expect(mockQuery).toHaveBeenNthCalledWith(
                1, 
                expect.stringContaining("id !="), 
                ["newname", "", 1]
        );

            expect(mockQuery).toHaveBeenLastCalledWith(
                expect.stringContaining("UPDATE users"),
                ["newname", null, 1]
            );
        });

        it("updates only the email when username is omitted", async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] })        // uniqueness check
                .mockResolvedValueOnce({ rows: [{ id: 1, username: "old", email: "new@example.com" }] });

            await updateUserProfile(1, { email: "new@example.com" });

            expect(mockQuery).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining("id !="),
                ["", "new@example.com", 1]
            );

            expect(mockQuery).toHaveBeenLastCalledWith(
                expect.stringContaining("UPDATE users"), [null, "new@example.com", 1]
            );
        });
    });

    describe("changeUserPassword", () => {
        it("throws a 400 when currentPassword or newPassword is missing", async () => {
            await expect(
                changeUserPassword(1, { currentPassword: "", newPassword: "newpass123" })
            ).rejects.toMatchObject({ status: 400 });
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it("throws a 400 when the new password is too short", async () => {
            await expect(
                changeUserPassword(1, { currentPassword: "oldpass", newPassword: "abc" })
            ).rejects.toMatchObject({ status: 400 });
        });

        it("throws a 404 when the user does not exist", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await expect(
                changeUserPassword(1, { currentPassword: "oldpass", newPassword: "newpass123" })
            ).rejects.toMatchObject({ status: 404 });
        });

        it("throws a 401 when the current password does not match", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ password_hash: "hashed" }] });
            mockCompare.mockResolvedValueOnce(false);

            await expect(
                changeUserPassword(1, { currentPassword: "wrong", newPassword: "newpass123" })
            ).rejects.toMatchObject({ status: 401, message: "Current password is incorrect" });
        });

        it("hashes and stores the new password when the current password matches", async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ password_hash: "hashed-old" }] })         // lookup
                .mockResolvedValueOnce({});     // update
            mockCompare.mockResolvedValueOnce(true);
            mockHash.mockResolvedValueOnce("hashed-new");

            const result = await changeUserPassword(1, {
                currentPassword: "correct",
                newPassword: "newpass123",
            });

            expect(mockHash).toHaveBeenCalledWith("newpass123", 10);
            expect(mockQuery).toHaveBeenLastCalledWith(
                expect.stringContaining("UPDATE users SET password_hash"),
                ["hashed-new", 1]
            );
            expect(result).toEqual({ message: "Password updated successfully" });
        });
    });

    describe("deleteUserAccount", () => {
        it("throws a 400 when no password is provided", async () => {
            await expect(deleteUserAccount(1, {})).rejects.toMatchObject({ status: 400 });
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it("throws a 404 when the user does not exist", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await expect(
                deleteUserAccount(1, { password: "whatever" })
            ).rejects.toMatchObject({ status: 404 });
        });

        it("throws a 401 when the password is incorrect", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ password_hash: "hashed" }] });
            mockCompare.mockResolvedValueOnce(false);

            await expect(
                deleteUserAccount(1, { password: "wrong" })
            ).rejects.toMatchObject({
                status: 401,
                message: "Incorrect password"
            });
        });

        it("deletes the account when the password matches", async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ password_hash: "hashed" }] })
                .mockResolvedValueOnce({});
            mockCompare.mockResolvedValueOnce(true);

            const result = await deleteUserAccount(1, { password: "correct" });

            expect(mockQuery).toHaveBeenLastCalledWith(
                expect.stringContaining("DELETE FROM users WHERE id = $1"), 
                [1]
            );

            expect(result).toEqual({ message: "Account deleted successfully" });
        });
    });
});