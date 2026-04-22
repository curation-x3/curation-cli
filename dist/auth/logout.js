import { clearAll } from "./keychain.js";
import { deleteUser } from "./user_store.js";
export async function logoutFlow() {
    await clearAll();
    deleteUser();
}
//# sourceMappingURL=logout.js.map