const OWNER = "Yogdunana";
const TRUSTED_LOGINS = new Set([OWNER, "cursor[bot]"]);

export function shouldCloseExternal({ eventName, action, userLogin, sameRepo, state }) {
  if (eventName === "issues") {
    if (TRUSTED_LOGINS.has(userLogin)) return { close: false, comment: false };
    return { close: true, comment: true };
  }

  if (TRUSTED_LOGINS.has(userLogin) && sameRepo) return { close: false, comment: false };
  if (state === "closed" && action === "synchronize") return { close: false, comment: false };
  return { close: true, comment: true };
}
