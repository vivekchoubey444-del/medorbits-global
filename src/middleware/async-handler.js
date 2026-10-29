/** Wrap an async Express handler and forward errors to next(). */
export default function asyncHandler(handler) { if (typeof handler !== "function") throw new TypeError("handler must be a function"); return (req,res,next) => Promise.resolve(handler(req,res,next)).catch(next); }
export { asyncHandler };
