import ApiResponse from "../utils/ApiResponse.js";
import {
  registerUser,
  loginUser,
  getCurrentUser,
} from "../services/auth.service.js";

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

  const result = await loginUser({ email, password });

  const response = new ApiResponse(200, "Login successful.", {
    user: result.user,
    token: result.token,
  });

  return res.status(200).json(response);
};

const getMe = async (req, res) => {
  const user = await getCurrentUser(req.user.id);

  const response = new ApiResponse(200, "User fetched successfully.", {
    user,
  });

  return res.status(200).json(response);
};

export { register, login, getMe };
