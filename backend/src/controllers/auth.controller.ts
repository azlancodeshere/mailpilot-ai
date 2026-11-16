/**
 * Auth endpoints delegate to the user controller, which owns the
 * register/login/refresh/logout implementations.
 */
export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
} from "./user.controller"
