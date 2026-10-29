import { EventEmitter } from "node:events";

/** In-process event bus; use a durable queue for cross-process delivery. */
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);
export function publish(eventName, payload) {
  if (typeof eventName !== "string" || !eventName.trim()) throw new TypeError("eventName is required");
  return eventBus.emit(eventName, payload);
}
export function subscribe(eventName, listener) {
  if (typeof listener !== "function") throw new TypeError("listener must be a function");
  eventBus.on(eventName, listener);
  return () => eventBus.off(eventName, listener);
}
export default eventBus;
