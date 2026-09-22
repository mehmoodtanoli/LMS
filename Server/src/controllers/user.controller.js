import ApiResponse from "../utils/ApiResponse.js";
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  setUserStatus,
} from "../services/user.service.js";

const create = async (req, res) => {
  const user = await createUser({ data: req.body });

  const response = new ApiResponse(201, "User created successfully.", {
    user,
  });

  return res.status(201).json(response);
};

const list = async (req, res) => {
  const result = await listUsers({ query: req.query });

  const response = new ApiResponse(
    200,
    "Users fetched successfully.",
    { users: result.users },
    result.meta,
  );

  return res.status(200).json(response);
};

const getById = async (req, res) => {
  const user = await getUserById({ userId: req.params.id });

  const response = new ApiResponse(200, "User fetched successfully.", {
    user,
  });

  return res.status(200).json(response);
};

const update = async (req, res) => {
  const user = await updateUser({ userId: req.params.id, data: req.body });

  const response = new ApiResponse(200, "User updated successfully.", {
    user,
  });

  return res.status(200).json(response);
};

const setStatus = async (req, res) => {
  const user = await setUserStatus({
    userId: req.params.id,
    isActive: req.body.isActive,
  });

  const response = new ApiResponse(200, "User status updated.", { user });

  return res.status(200).json(response);
};

export { create, list, getById, update, setStatus };
