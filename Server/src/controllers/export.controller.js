import ApiResponse from "../utils/ApiResponse.js";
import {
  exportComplete,
  exportDataset,
  listExportDatasets,
  listExportHistory,
} from "../services/export.service.js";

function sendFile(res, file) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(file.body);
}

// Note: laboratoryId is never read from the request. Scope comes from req.user.

export const getDatasets = async (req, res, next) => {
  try {
    const datasets = listExportDatasets(req.user);
    return res
      .status(200)
      .json(new ApiResponse(200, "Export datasets retrieved.", { datasets }));
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    const result = await listExportHistory({ user: req.user, query: req.query });
    return res.status(200).json(new ApiResponse(200, "Export history retrieved.", result));
  } catch (error) {
    next(error);
  }
};

export const downloadDataset = async (req, res, next) => {
  try {
    const file = await exportDataset({
      user: req.user,
      dataset: req.params.dataset,
      format: req.query.format,
      from: req.query.from,
      to: req.query.to,
    });
    return sendFile(res, file);
  } catch (error) {
    next(error);
  }
};

export const downloadComplete = async (req, res, next) => {
  try {
    const file = await exportComplete({
      user: req.user,
      from: req.query.from,
      to: req.query.to,
    });
    return sendFile(res, file);
  } catch (error) {
    next(error);
  }
};

export default { getDatasets, getHistory, downloadDataset, downloadComplete };