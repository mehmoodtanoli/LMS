import ApiResponse from "../utils/ApiResponse.js";
import { createPayment, listPayments, getPaymentById } from "../services/payment.service.js";

const create = async (req, res) => {
  const payment = await createPayment({ user: req.user, data: req.body });

  const response = new ApiResponse(201, "Payment created successfully.", {
    payment,
  });

  return res.status(201).json(response);
};

const list = async (req, res) => {
  const result = await listPayments({ user: req.user, query: req.query });

  const response = new ApiResponse(200, "Payments fetched successfully.", {
    payments: result.payments,
  }, result.meta);

  return res.status(200).json(response);
};

const getById = async (req, res) => {
  const payment = await getPaymentById({ user: req.user, paymentId: req.params.id });

  const response = new ApiResponse(200, "Payment fetched successfully.", {
    payment,
  });

  return res.status(200).json(response);
};

export { create, list, getById };