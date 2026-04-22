import { CurationError } from "./errors.js";
let _pretty = false;
export function setPretty(value) {
    _pretty = value;
}
export function isPretty() {
    return _pretty;
}
export function outputJSON(data) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}
export function outputError(err) {
    if (err instanceof CurationError) {
        if (_pretty) {
            process.stderr.write(`Error: ${err.message}\n`);
        }
        else {
            process.stderr.write(JSON.stringify(err.toJSON()) + "\n");
        }
        process.exit(err.code);
    }
    const message = err instanceof Error ? err.message : String(err);
    if (_pretty) {
        process.stderr.write(`Error: ${message}\n`);
    }
    else {
        process.stderr.write(JSON.stringify({ error: "unknown", message }) + "\n");
    }
    process.exit(1);
}
//# sourceMappingURL=output.js.map