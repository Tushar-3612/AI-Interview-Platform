/**
 * Route Guards & Authorization Helpers
 * Note: Backend authentication remains authoritative.
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem("token"));
}

export function hasRole(requiredRoles) {
  const user = getStoredUser();
  if (!user || !user.role) return false;
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(user.role);
}
