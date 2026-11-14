const OWNER = "Yogdunana";

export function shouldCloseExternal({ eventName, action, userLogin, sameRepo, state }) {
  if (eventName === "issues") {
    if (userLogin === OWNER) return { close: false, comment: false };
    return { close: true, comment: true };
  }

  if (userLogin === OWNER && sameRepo) return { close: false, comment: false };
  if (state === "closed" && action === "synchronize") return { close: false, comment: false };
  return { close: true, comment: true };
}
