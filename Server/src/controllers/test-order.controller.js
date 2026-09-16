import ApiResponse from "../utils/ApiResponse.js";
import {
  createTestOrder,
  listTestOrders,
  getTestOrderById,
  updateTestOrder,
  deleteTestOrder,
} from "../services/test-order.service.js";

const create = async (req, res) => {
  const order = await createTestOrder({ user: req.user, data: req.body });

  const response = new ApiResponse(201, "Test order created successfully.", {
    order,
  });

  return res.status(201).json(response);
};

const list = async (req, res) => {
  const result = await listTestOrders({ user: req.user, query: req.query });

  const response = new ApiResponse(
    200,
    "Test orders fetched successfully.",
    {
      orders: result.orders,
    },
    result.meta,
  );

  return res.status(200).json(response);
};

const getById = async (req, res) => {
  const order = await getTestOrderById({ user: req.user, orderId: req.params.id });

  const response = new ApiResponse(200, "Test order fetched successfully.", {
    order,
  });

  return res.status(200).json(response);
};

const update = async (req, res) => {
  const order = await updateTestOrder({
    user: req.user,
    orderId: req.params.id,
    data: req.body,
  });

  const response = new ApiResponse(200, "Test order updated successfully.", {
    order,
  });

  return res.status(200).json(response);
};

const remove = async (req, res) => {
  const order = await deleteTestOrder({ user: req.user, orderId: req.params.id });

  const response = new ApiResponse(200, "Test order deleted successfully.", {
    order,
  });

  return res.status(200).json(response);
};

export { create, list, getById, update, remove };