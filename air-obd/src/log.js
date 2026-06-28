export function makeLogger(tag) {
  const line = (fn, ...args) =>
    fn(`${new Date().toISOString()} [${tag}]`, ...args);
  return {
    info: (...a) => line(console.log, ...a),
    warn: (...a) => line(console.warn, ...a),
    error: (...a) => line(console.error, ...a),
  };
}
