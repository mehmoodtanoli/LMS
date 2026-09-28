import ApiResponse from "../utils/ApiResponse.js";
import {
  createPatient,
  listPatients,
  getPatientById,
  updatePatient,
  deletePatient,
} from "../services/patient.service.js";

const create = async (req, res) => {
  const patient = await createPatient({ user: req.user, data: req.body });

  const response = new ApiResponse(201, "Patient created successfully.", {
    patient,
  });

  return res.status(201).json(response);
};

const list = async (req, res) => {
  const result = await listPatients({ user: req.user, query: req.query });

  const response = new ApiResponse(200, "Patients fetched successfully.", {
    patients: result.patients,
  }, result.meta);

  return res.status(200).json(response);
};

const getById = async (req, res) => {
  const patient = await getPatientById({ user: req.user, patientId: req.params.id });

  const response = new ApiResponse(200, "Patient fetched successfully.", {
    patient,
  });

  return res.status(200).json(response);
};

const update = async (req, res) => {
  const patient = await updatePatient({
    user: req.user,
    patientId: req.params.id,
    data: req.body,
  });

  const response = new ApiResponse(200, "Patient updated successfully.", {
    patient,
  });

  return res.status(200).json(response);
};

const remove = async (req, res) => {
  const patient = await deletePatient({ user: req.user, patientId: req.params.id });

  const response = new ApiResponse(200, "Patient deleted successfully.", {
    patient,
  });

  return res.status(200).json(response);
};

export { create, list, getById, update, remove };