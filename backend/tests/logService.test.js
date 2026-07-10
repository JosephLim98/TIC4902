import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

class MockWebSocket {
    constructor(url) {
        if (MockWebSocket.throwOnNextConstruct) {
            MockWebSocket.throwOnNextConstruct = false;
            throw new Error("bad url");
        }
        this.url = url;
        this.listeners = {};
        MockWebSocket.instances.push(this);
    }

    on(event, cb) {
        (this.listeners[event] ||= []).push(cb);
        return this;
    }

    emit(event, ...args) {
        (this.listeners[event] || []).forEach((cb) => cb(...args));
    }

    removeAllListeners() {
        this.listeners = {};
    }

    close() {}
}

MockWebSocket.instances = [];
MockWebSocket.throwOnNextConstruct = false;

jest.unstable_mockModule("ws", () => ({
    default: MockWebSocket,
}));

const { queryRange, openTailSocket } = await import("../src/service/logService.js");

describe("Log Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MockWebSocket.instances = [];
    });

    describe("queryRange", () => {
        afterEach(() => {
            delete global.fetch;
        });

        it("builds a LogQL query scoped to deployment and calls Loki", async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    data: {
                        result: [
                            {
                                stream: { level: "INFO" },
                                values: [
                                    ["2000000000", "second line"],
                                    ["1000000000", "first line"],
                                ],
                            },
                        ],
                    },
                }),
            };

            global.fetch = jest.fn().mockResolvedValue(mockResponse);

            const result = await queryRange(
                { deploymentName: "my-job", component: "jobmanager" },
                1000000000,
                2000000000
            );

            const calledUrl = global.fetch.mock.calls[0][0];
            expect(calledUrl).toContain("query_range");
            expect(decodeURIComponent(calledUrl)).toContain('app="my-job"');
            expect(decodeURIComponent(calledUrl)).toContain('component="jobmanager"');

            // results are sorted ascending by timestamp (ns -> ms)
            expect(result).toEqual([
                { ts: 1000, line: "first line", stream: { level: "INFO" } },
                { ts: 2000, line: "second line", stream: { level: "INFO" } },
            ]);
        });

        it("escapes quotes and backslashes in the search term", async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ data: { result: [] } }),
            });

            await queryRange(
                { deploymentName: "my-job", search: 'inject" | line_format "pwned' },
                0,
                1
            );

            const calledUrl = decodeURIComponent(global.fetch.mock.calls[0][0]);

            expect(calledUrl).toContain('\\"pwned');
            expect(calledUrl).not.toContain('|= "inject" | line_format "pwned"');
        });

        it("filters by uppercased log levels when provided", async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ data: { result: [] } }),
            });

            await queryRange({
                deploymentName: "my-job",
                levels: ["warn", "error"]
            }, 0, 1);

            const calledUrl = decodeURIComponent(global.fetch.mock.calls[0][0]);
            expect(calledUrl).toContain('level=~"WARN|ERROR"');
        });

        it("throws when the Loki request is not ok", async () => {
            global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

            await expect(queryRange({ deploymentName: "my-job" }, 0, 1)).rejects.toThrow("Loki query_range failed: 500");
        });

        it("returns an empty array when Loki has no matching streams", async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ data: { result: [] } }),
            });

            const result = await queryRange({ deploymentName: "my-job" }, 0, 1);
            expect(result).toEqual([]);
        });
    });

    describe("openTailSocket", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("opens a websocket scoped to the deployment and reports 'connected' on open", () => {
            const onLine = jest.fn();
            const onStatus = jest.fn();

            const handle = openTailSocket({ deploymentName: "my-job" }, onLine, onStatus);

            expect(MockWebSocket.instances).toHaveLength(1);
            expect(decodeURIComponent(MockWebSocket.instances[0].url)).toContain('app="my-job"');

            MockWebSocket.instances[0].emit("open");
            expect(onStatus).toHaveBeenCalledWith("connected");

            handle.close();
        });

        it("forwards parsed log lines to onLine with ns->ms timestamp conversion", () => {
            const onLine = jest.fn();
            const handle = openTailSocket({ deploymentName: "my-job" }, onLine, jest.fn());

            const socket = MockWebSocket.instances[0];

            socket.emit(
                "message",
                Buffer.from(
                    JSON.stringify({
                        streams: [{
                            stream: { level: "INFO" }, values: [["3000000000", "hello"]]
                        }],
                    })
                )
            );

            expect(onLine).toHaveBeenCalledWith({ ts: 3000, line: "hello", stream: { level: "INFO" } });
            
            handle.close();
        });

        it("does not throw and does not call onLine when a frame is malformed JSON", () => {
            const onLine = jest.fn();
            const handle = openTailSocket({ deploymentName: "my-job" }, onLine, jest.fn());

            const socket = MockWebSocket.instances[0];
            expect(() => socket.emit("message", Buffer.from("not json"))).not.toThrow();
            expect(onLine).not.toHaveBeenCalled();

            handle.close();
        });

        it("reconnects with backoff after the socket closes unexpectedly", () => {
            const onStatus = jest.fn();
            const handle = openTailSocket({ deploymentName: "my-job" }, jest.fn(), onStatus);

            expect(MockWebSocket.instances).toHaveLength(1);
            MockWebSocket.instances[0].emit("close");

            expect(onStatus).toHaveBeenCalledWith("reconnecting");

            jest.advanceTimersByTime(1000);
            expect(MockWebSocket.instances).toHaveLength(2);

            handle.close();
        });

        it("stops reconnecting once close() has been called", () => {
            const handle = openTailSocket({ deploymentName: "my-job" }, jest.fn(), jest.fn());
            const socket = MockWebSocket.instances[0];

            handle.close();
            socket.emit("close");

            jest.advanceTimersByTime(20000);
            // no new socket should have been created after an intentional close
            expect(MockWebSocket.instances).toHaveLength(1);
        });

        it("logs and schedules a reconnect when constructing the WebSocket throws", () => {
            const onStatus = jest.fn();
            MockWebSocket.throwOnNextConstruct = true;

            const handle = openTailSocket({ deploymentName: "my-job" }, jest.fn(), onStatus);

            // constructor threw, so no socket instance exists yet and we're not "connected"
            expect(MockWebSocket.instances).toHaveLength(0);
            expect(onStatus).toHaveBeenCalledWith("reconnecting");

            // the scheduled retry succeeds now that the flag has been consumed
            jest.advanceTimersByTime(1000);
            expect(MockWebSocket.instances).toHaveLength(1);

            handle.close();
        });

        it("does not create a new socket if close() runs before a pending reconnect fires", () => {
            const handle = openTailSocket({ deploymentName: "my-job" }, jest.fn(), jest.fn());
            MockWebSocket.instances[0].emit("close");       // schedules a reconnect timer

            handle.close();     // closed=true before the timer fires; clears the pending timer
            jest.advanceTimersByTime(20000);

            expect(MockWebSocket.instances).toHaveLength(1);
        });

        it("logs socket errors without throwing", () => {
            const handle = openTailSocket({ deploymentName: "my-job"}, jest.fn(), jest.fn());
            const socket = MockWebSocket.instances[0];

            expect(() => socket.emit("error", new Error("connection reset"))).not.toThrow();
            handle.close();
        });
    });
});