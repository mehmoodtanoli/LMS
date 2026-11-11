import ApiResponse from "../utils/ApiResponse.js";
import { getSupportConfig, createSupportTicket } from "../services/support.service.js";

export const getConfig = async (req, res, next) => {
  try {
    const config = await getSupportConfig(req.user);
    const response = new ApiResponse(200, "Support configuration retrieved.", config);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const ticket = await createSupportTicket({
      user: req.user,
      payload: req.body,
    });

    const response = new ApiResponse(201, "Support request submitted successfully.", ticket);
    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

export const supportController = {
  getConfig,
  create,
};

export default supportController;
