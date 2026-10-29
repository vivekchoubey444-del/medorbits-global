/** Storage provider contract. Replace with a configured object-storage adapter. */
export function createStorageProvider() {
  return { async put() { throw new Error("Storage provider is not configured"); }, async get() { throw new Error("Storage provider is not configured"); }, async delete() { throw new Error("Storage provider is not configured"); } };
}
export default createStorageProvider;
