import { clearAll } from "./keychain.js";
import { deleteUser } from "./user_store.js";

export async function logoutFlow(): Promise<void> {
  await clearAll();
  deleteUser();
}
