import ApiResponse from "../utils/ApiResponse.js";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  changeUserPassword,
} from "../services/auth.service.js";
import { setSessionCookie, clearSessionCookie } from "../utils/sessionCookie.js";
import {
  recordFailedLogin,
  recordSuccessfulLogin,
} from "../middlewares/rateLimiter.middleware.js";

const register = async (req, res) => {
  const { email, password, laboratoryId } = req.body;

  const user = await registerUser({
    actor: req.user,
    email,
    password,
    laboratoryId,
  });

  const response = new ApiResponse(201, "User registered successfully.", {
    user,
  });

  return res.status(201).json(response);
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await loginUser({ email, password });
    recordSuccessfulLogin(req, email);
    setSessionCookie(res, result.token);

    // The token is only sent as the httpOnly cookie, never in the body page scripts can read.
    const response = new ApiResponse(200, "Login successful.", {
      user: result.user,
    });

    return res.status(200).json(response);
  } catch (error) {
    if (error?.statusCode === 401) {
      await recordFailedLogin(req, email);
    }
    throw error;
  }
};

const getMe = async (req, res) => {
  const user = await getCurrentUser(req.user.id);

  const response = new ApiResponse(200, "User fetched successfully.", {
    user,
  });

  return res.status(200).json(response);
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const result = await changeUserPassword({
    userId: req.user.id,
    currentPassword,
    newPassword,
  });

  // The password change ended older sessions; keep this one with the fresh token.
  setSessionCookie(res, result.token);

  return res
    .status(200)
    .json(new ApiResponse(200, "Password updated successfully.", { message: result.message }));
};

const logout = async (req, res) => {
  clearSessionCookie(res);
  return res.status(200).json(new ApiResponse(200, "Logged out.", null));
};

export { register, login, getMe, changePassword, logout };
