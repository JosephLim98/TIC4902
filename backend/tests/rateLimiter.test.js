import { describe, expect, it, jest } from "@jest/globals";
import { loginLimiter, registerLimiter } from "../src/middleware/rateLimiter.js";

function fakeReq(ip) {
    return { ip, method: "POST", path: "/login", headers: {} };
}

function fakeRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.send = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.setHeader = jest.fn(() => res);
    res.getHeader = jest.fn(() => undefined);
    res.removeHeader = jest.fn(() => res);
    res.writableEnded = false;
    return res;
}

// express-rate-limit's default handler is async; each test explicitly awaits the middleware call via a Promise so status()/send() assertions are safe
describe("rateLimiter", () => {
    describe("loginLimiter", () => {
        it("allows requests under the limit through to next()", async () => {
            const req = fakeReq("10.0.0.1");
            const res = fakeRes();
            const next = jest.fn();

            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => {
                    loginLimiter(req, res, () => {
                        next();
                        resolve();
                    });
                });
            }

            expect(next).toHaveBeenCalledTimes(5);
            expect(res.status).not.toHaveBeenCalledWith(429);
        });

        it("blocks the 6th request from the same IP within the window", async () => {
            const req = fakeReq("10.0.0.2");
            const res = fakeRes();
            const next = jest.fn();

            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => {
                    loginLimiter(req, res, () => {
                        next();
                        resolve();
                    });
                });
            }

            // 6th attempt should be rejected by the limiter
            await new Promise((resolve) => {
                loginLimiter(req, res, () => {
                    next();         // should not be reached
                    resolve();
                });
                setImmediate(resolve);
            });

            expect(next).toHaveBeenCalledTimes(5);              // should not be called a 6th time
            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining("Too many login attempts")})
            );
        });

        it("tracks separate IPs independently", async () => {
            const resA = fakeRes();
            const resB = fakeRes();
            const nextA = jest.fn();
            const nextB = jest.fn();

            // exhaust the limit for IP A only
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => {
                    loginLimiter(fakeReq("10.0.0.3"), resA, () => {
                        nextA();
                        resolve();
                    });
                });
            }

            // IP B should not be affected by IP A's usage
            await new Promise((resolve) => {
                loginLimiter(fakeReq("10.0.0.4"), resB, () => {
                    nextB();
                    resolve();
                });
            });

            expect(nextB).toHaveBeenCalledTimes(1);
            expect(resB.status).not.toHaveBeenCalledWith(429);
        });
    });

    describe("registerLimiter", () => {
        it("allows up to 10 requests before blocking", async () => {
            const req = fakeReq("10.0.1.1");
            const res = fakeRes();
            const next = jest.fn();

            for (let i = 0; i < 10; i++) {
                await new Promise((resolve) => {
                    registerLimiter(req, res, () => {
                        next();
                        resolve();
                    });
                });
            }

            expect(next).toHaveBeenCalledTimes(10);

            await new Promise((resolve) => {
                registerLimiter(req, res, () => {
                    next();
                    resolve();
                });
                setImmediate(resolve);
            });

            expect(next).toHaveBeenCalledTimes(10);     // 11th call did not go through
            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining("Too many registration attempts")
                })
            );
        });

        it("is tracked independently from loginLimiter for the same IP", async () => {
            const ip = "10.0.1.2";
            const res = fakeRes();
            const next = jest.fn();

            // exhaust loginLimiter for this IP
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => {
                    loginLimiter(fakeReq(ip), res, () => {
                        next();
                        resolve();
                    });
                });
            }

            // registerLimiter should be untouched (separate limiter instance/store)
            await new Promise((resolve) => {
                registerLimiter(fakeReq(ip), res, () => {
                    next();
                    resolve();
                });
            });

            expect(next).toHaveBeenCalledTimes(6);      // 5 logins + 1 register, none blocked
        });
    });
});