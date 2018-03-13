"use strict";

const assert = require("assert");
const { Readable, Writable, Transform } = require("stream");

const Reporter = require("../index");

function source(length) {
    const list = [];
    for (let i = 0; i < length; i++) {
        list.push(Buffer.allocUnsafe(10));
    }
    return list;
}

function random(max) {
    return Math.floor(Math.random() * max);
}

class SyncRead extends Readable {
    constructor(opts) {
        super(opts);
        this.list = source(100);
    }
    _read() {
        const v = this.list.shift() || null;
        this.push(v);
    }
}
class AsyncRead extends Readable {
    constructor(opts) {
        super(opts);
        this.list = source(100);
    }
    _read() {
        const v = this.list.shift() || null;
        setTimeout(() => {
            this.push(v);
        }, random(10));
    }
}

class SyncTransform extends Transform {
    _transform(chunk, encoding, callback) {
        callback(null, chunk);
    }
}

class AsyncTransform extends Transform {
    _transform(chunk, encoding, callback) {
        setTimeout(() => {
            callback(null, chunk);
        }, random(10));
    }
}
class SyncWrite extends Writable {
    _write(chunk, encoding, callback) {
        callback(null, chunk);
    }
}
class AsyncWrite extends Writable {
    _write(chunk, encoding, callback) {
        setTimeout(() => {
            callback(null, chunk);
        }, random(10));
    }
}

describe("stream-stats-reporter", () => {
    describe("sync", () => {
        describe("serial", () => {
            it("", (done) => {
                const expect = [
                    {
                        name: "SyncRead",
                        layer: 1,
                        index: 0,
                        path: [0],
                    },
                    {
                        name: "SyncTransform",
                        layer: 2,
                        index: 0,
                        path: [0, 0],
                    },
                    {
                        name: "SyncTransform",
                        layer: 3,
                        index: 0,
                        path: [0, 0, 0],
                    },
                    {
                        name: "SyncTransform",
                        layer: 4,
                        index: 0,
                        path: [0, 0, 0, 0],
                    },
                    {
                        name: "SyncWrite",
                        layer: 5,
                        index: 0,
                        path: [0, 0, 0, 0, 0],
                    }
                ];
                const reporter = new Reporter();
                const readable = new SyncRead();
                readable.pipe(new SyncTransform())
                    .pipe(new SyncTransform())
                    .pipe(new SyncTransform())
                    .pipe(new SyncWrite())
                    .on("finish", () => {
                        const stats = reporter.stats();
                        for (let i = 0; i < stats.length; i++) {
                            const s = stats[i];
                            const e = expect[i];
                            assert.equal(s.name, e.name);
                            assert.equal(s.layer, e.layer);
                            assert.equal(s.index, e.index);
                            assert.deepStrictEqual(s.path, e.path);
                            // assert.ok(s.stats.min < 1);
                            // assert.ok(s.stats.max < 10);
                            // assert.ok(s.stats.sum < 1000);
                            assert.equal(s.stats.count, 100);
                            // assert.ok(s.stats.mean < 1);
                            // assert.ok(s.stats.stddev < 1);
                        }
                        done();
                    });
                reporter.register(readable);
            });
        });
        describe("branch", () => {
            it("", () => {
                const expect = [
                    {
                        name: "SyncRead",
                        layer: 1,
                        index: 0,
                        path: [0],
                    },
                    {
                        name: "SyncTransform",
                        layer: 2,
                        index: 0,
                        path: [0, 0],
                    },
                    {
                        name: "SyncWrite",
                        layer: 3,
                        index: 0,
                        path: [0, 0, 0],
                    },
                    {
                        name: "SyncTransform",
                        layer: 2,
                        index: 1,
                        path: [0, 1],
                    },
                    {
                        name: "SyncWrite",
                        layer: 3,
                        index: 0,
                        path: [0, 1, 0],
                    }
                ];
                const reporter = new Reporter();
                const readable = new SyncRead();
                const p1 = new Promise((resolve) => {
                    readable.pipe(new SyncTransform())
                        .pipe(new SyncWrite())
                        .on("finish", () => {
                            resolve();
                        });
                });
                const p2 = new Promise((resolve) => {
                    readable.pipe(new SyncTransform())
                        .pipe(new SyncWrite())
                        .on("finish", () => {
                            resolve();
                        });
                });
                reporter.register(readable);
                return Promise.all([p1, p2]).then(() => {
                    const stats = reporter.stats();
                    for (let i = 0; i < stats.length; i++) {
                        const s = stats[i];
                        const e = expect[i];
                        assert.equal(s.name, e.name);
                        assert.equal(s.layer, e.layer);
                        assert.equal(s.index, e.index);
                        assert.deepStrictEqual(s.path, e.path);
                        // assert.ok(s.stats.min < 1);
                        // assert.ok(s.stats.max < 10);
                        // assert.ok(s.stats.sum < 1000);
                        assert.equal(s.stats.count, 100);
                        // assert.ok(s.stats.mean < 1);
                        // assert.ok(s.stats.stddev < 1);
                    }
                });
            });
        });
    });
    describe("sync", function () {
        this.slow(10000);
        this.timeout(700);
        describe("serial", () => {
            it("", (done) => {
                const expect = [
                    {
                        name: "AsyncRead",
                        layer: 1,
                        index: 0,
                        path: [0],
                    },
                    {
                        name: "AsyncTransform",
                        layer: 2,
                        index: 0,
                        path: [0, 0],
                    },
                    {
                        name: "AsyncTransform",
                        layer: 3,
                        index: 0,
                        path: [0, 0, 0],
                    },
                    {
                        name: "AsyncTransform",
                        layer: 4,
                        index: 0,
                        path: [0, 0, 0, 0],
                    },
                    {
                        name: "AsyncWrite",
                        layer: 5,
                        index: 0,
                        path: [0, 0, 0, 0, 0],
                    }
                ];
                const reporter = new Reporter();
                const readable = new AsyncRead();
                readable.pipe(new AsyncTransform())
                    .pipe(new AsyncTransform())
                    .pipe(new AsyncTransform())
                    .pipe(new AsyncWrite())
                    .on("finish", () => {
                        const stats = reporter.stats();
                        for (let i = 0; i < stats.length; i++) {
                            const s = stats[i];
                            const e = expect[i];
                            assert.equal(s.name, e.name);
                            assert.equal(s.layer, e.layer);
                            assert.equal(s.index, e.index);
                            assert.deepStrictEqual(s.path, e.path);
                            // assert.ok(s.stats.min <= 1, `${s.stats.min} <= 1`);
                            // assert.ok(s.stats.max <= 11, `${s.stats.max} <= 11`);
                            // assert.ok(s.stats.sum <= 600, `${s.stats.sum} <= 600`);
                            assert.equal(s.stats.count, 100);
                            // assert.ok(s.stats.mean <= 6, `${s.stats.mean} <= 6`);
                            // assert.ok(s.stats.stddev <= 4, `${s.stats.stddev} <= 4`);
                        }
                        done();
                    });
                reporter.register(readable);
            });
        });
        describe("branch", () => {
            it("", () => {
                const expect = [
                    {
                        name: "AsyncRead",
                        layer: 1,
                        index: 0,
                        path: [0],
                    },
                    {
                        name: "AsyncTransform",
                        layer: 2,
                        index: 0,
                        path: [0, 0],
                    },
                    {
                        name: "AsyncWrite",
                        layer: 3,
                        index: 0,
                        path: [0, 0, 0],
                    },
                    {
                        name: "AsyncTransform",
                        layer: 2,
                        index: 1,
                        path: [0, 1],
                    },
                    {
                        name: "AsyncWrite",
                        layer: 3,
                        index: 0,
                        path: [0, 1, 0],
                    }
                ];
                const reporter = new Reporter();
                const readable = new AsyncRead();
                const p1 = new Promise((resolve) => {
                    readable.pipe(new AsyncTransform())
                        .pipe(new AsyncWrite())
                        .on("finish", () => {
                            resolve();
                        });
                });
                const p2 = new Promise((resolve) => {
                    readable.pipe(new AsyncTransform())
                        .pipe(new AsyncWrite())
                        .on("finish", () => {
                            resolve();
                        });
                });
                reporter.register(readable);
                return Promise.all([p1, p2]).then(() => {
                    const stats = reporter.stats();
                    for (let i = 0; i < stats.length; i++) {
                        const s = stats[i];
                        const e = expect[i];
                        assert.equal(s.name, e.name);
                        assert.equal(s.layer, e.layer);
                        assert.equal(s.index, e.index);
                        assert.deepStrictEqual(s.path, e.path);
                        // assert.ok(s.stats.min <= 1, `${s.stats.min} <= 1`);
                        // assert.ok(s.stats.max <= 11, `${s.stats.max} <= 11`);
                        // assert.ok(s.stats.sum <= 600, `${s.stats.sum} <= 600`);
                        assert.equal(s.stats.count, 100);
                        // assert.ok(s.stats.mean <= 6, `${s.stats.mean} <= 6`);
                        // assert.ok(s.stats.stddev <= 4, `${s.stats.stddev} <= 4`);
                    }
                });
            });
        });
    });
});
