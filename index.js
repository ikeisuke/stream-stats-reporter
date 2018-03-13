"use strict";

const { Readable, Writable, Transform } = require("stream");
const NS_PER_SEC = 1e9;

const mode = (() => {
    if (global.process === undefined) {
        return "milliseconds";
    }
    if (process.hrtime instanceof Function) {
        return "nanoseconds";
    }
    return "milliseconds";
})();

class Stats {
    constructor() {
        this.min = 0;
        this.max = 0;
        this.sum = 0;
        this.count = 0;
        this.mean = 0;
        this.stddev = 0;

        Object.defineProperty(this, "values", {
            value: [],
            writable: false,
        });
    }

    add(value) {
        if (this.min > value) { this.min = value; }
        if (this.max < value) { this.max = value; }
        if (value) { this.sum += value; }
        this.count++;
        this.values.push(value);
    }

    calc() {
        if (this.count === 0) {
            return;
        }
        this.mean = this.sum / this.count;
        let sum = 0;
        for (let i = 0; i < this.count; i++) {
            const diff = this.values[i] - this.mean;
            sum += diff * diff;
        }
        this.stddev = Math.sqrt(sum / this.count);
    }
}

const measure = {
    milliseconds: {
        transform(stream, stats) {
            const transform = stream._transform;
            stream._transform = function (chunk, encoding, callback) {
                const time = +new Date();
                transform.call(this, chunk, encoding, function (err, chunk) {
                    stats.add(+new Date() - time);
                    callback.call(this, err, chunk);
                });
            };
            stream.prependOnceListener("end", () => { stats.calc(); });
        },
        write(stream, stats) {
            const write = stream._write;
            stream._write = function (chunk, encoding, callback) {
                const time = +new Date();
                write.call(this, chunk, encoding, function (err, chunk) {
                    stats.add(+new Date() - time);
                    callback.call(this, err, chunk);
                });
            };
            stream.prependOnceListener("finish", () => { stats.calc(); });
        },
        read(stream, stats) {
            const read = stream._read;
            const push = stream.push;
            stream._read = function (size) {
                const time = +new Date();
                stream.push = function (chunk) {
                    if (chunk !== null) {
                        stats.add(+new Date() - time);
                    }
                    push.call(this, chunk);
                };
                read.call(this, size);
            };
            stream.prependOnceListener("end", () => { stats.calc(); });
        },
    },
    nanoseconds: {
        transform(stream, stats) {
            const transform = stream._transform;
            stream._transform = function (chunk, encoding, callback) {
                const time = process.hrtime();
                transform.call(this, chunk, encoding, function (err, chunk) {
                    const diff = process.hrtime(time);
                    stats.add(diff[0] * NS_PER_SEC + diff[1]);
                    callback.call(this, err, chunk);
                });
            };
            stream.prependOnceListener("end", () => { stats.calc(); });
        },
        write(stream, stats) {
            const write = stream._write;
            stream._write = function (chunk, encoding, callback) {
                const time = process.hrtime();
                write.call(this, chunk, encoding, function (err, chunk) {
                    const diff = process.hrtime(time);
                    stats.add(diff[0] * NS_PER_SEC + diff[1]);
                    callback.call(this, err, chunk);
                });
            };
            stream.prependOnceListener("finish", () => { stats.calc(); });
        },
        read(stream, stats) {
            const read = stream._read;
            const push = stream.push;
            stream._read = function (size) {
                const time = process.hrtime();
                stream.push = function (chunk) {
                    if (chunk !== null) {
                        const diff = process.hrtime(time);
                        stats.add(diff[0] * NS_PER_SEC + diff[1]);
                    }
                    push.call(this, chunk);
                };
                read.call(this, size);
            };
            stream.prependOnceListener("end", () => { stats.calc(); });
        },
    }
};

class StreamStatsReporter {
    constructor(type) {
        this.measure = measure[type] || measure[mode];
        this.results = [];
    }

    wrap(stream, stats) {
        switch (true) {
        case stream instanceof Transform:
            this.measure.transform(stream, stats);
            break;
        case stream instanceof Writable:
            this.measure.write(stream, stats);
            break;
        case stream instanceof Readable:
            this.measure.read(stream, stats);
            break;
        }
    }

    register(stream, index, parentLayer, parentPath) {
        index = index || 0;
        parentLayer = parentLayer || 0;
        parentPath = parentPath || [];
        const stats = new Stats();
        this.wrap(stream, stats);
        const path = [index];
        const layer = parentLayer + 1;
        Array.prototype.unshift.apply(path, parentPath);
        const result = {
            name: stream.constructor.name,
            layer: layer,
            index: index,
            path: path,
            stats: stats,
        };
        this.results.push(result);
        if (!stream._readableState) {
            return;
        }
        let pipes = stream._readableState.pipes;
        if (!pipes) {
            return;
        }
        if (!Array.isArray(pipes)) {
            pipes = [pipes];
        }
        for (let i = 0; i < pipes.length; i++) {
            const stream = pipes[i];
            this.register(stream, i, layer, path);
        }
    }

    stats() {
        return this.results;
    }
}

module.exports = StreamStatsReporter;
