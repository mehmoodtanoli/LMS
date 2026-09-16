import ApiResponse from "../utils/ApiResponse.js";
import { createReport, listReports, getReportById } from "../services/report.service.js";

const create = async (req, res) => {
  const report = await createReport({ user: req.user, data: req.body });

  const response = new ApiResponse(201, "Report created successfully.", {
    report,
  });

  return res.status(201).json(response);
};

const list = async (req, res) => {
  const result = await listReports({ user: req.user, query: req.query });

  const response = new ApiResponse(200, "Reports fetched successfully.", {
    reports: result.reports,
  }, result.meta);

  return res.status(200).json(response);
};

const getById = async (req, res) => {
  const report = await getReportById({ user: req.user, reportId: req.params.id });

  const response = new ApiResponse(200, "Report fetched successfully.", {
    report,
  });

  return res.status(200).json(response);
};

export { create, list, getById };