import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockVerify = jest.fn();

jest.unstable_mockModule('jsonwebtoken', () => ({
    default: { verify: mockVerify },
}));

const { default: authMiddleware } = await import('../src/middleware/auth.js');

function fakeRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
});

describe('authMiddleware', () => {
    it('rejects with 401 when no Authorization header is present', () => {
        const req = { headers: {} };
        const res = fakeRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(mockVerify).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the Authorization header has no token after "Bearer"', () => {
        const req = {
            headers: {
                authorization: 'Bearer'
            }
        };
        const res = fakeRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects with 403 when the token is invalid or expired', () => {
        mockVerify.mockImplementationOnce(() => {
            throw new Error('jwt expired');
        });

        const req = {
            headers: {
                authorization: 'Bearer bad.token.here'
            }
        };

        const res = fakeRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('attaches the decoded user and calls next() for a valid token', () => {
        mockVerify.mockReturnValueOnce({
            user: {
                id: 1,
                username: 'alice'
            }
        });
        const req = {
            headers: {
                authorization: 'Bearer good.token.here'
            }
        };
        const res = fakeRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(req.user).toEqual({
            id: 1,
            username: 'alice'
        });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});