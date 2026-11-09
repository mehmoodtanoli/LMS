import ApiResponse from "../utils/ApiResponse.js";
import { getDashboardStatistics } from "../services/dashboard.service.js";

const getSummary = async (req, res) => {
  const statistics = await getDashboardStatistics({ user: req.user });
  return res.status(200).json(
    new ApiResponse(200, "Dashboard statistics fetched.", statistics)
  );
};

export { getSummary };
