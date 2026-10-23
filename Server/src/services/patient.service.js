import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
  normalizeOptionalString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

const VALID_GENDERS = ["MALE", "FEMALE", "OTHER"];
const VALID_AGE_UNITS = ["YEARS", "MONTHS", "DAYS"];

function normalizeGender(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  return normalizedValue || undefined;
}

function normalizeAgeUnit(value) {
  if (!value) return "YEARS";
  const normalizedValue = normalizeString(value).toUpperCase();
  if (!VALID_AGE_UNITS.includes(normalizedValue)) {
    throw new ApiError(400, "ageUnit must be one of YEARS, MONTHS, or DAYS.", {
      field: "ageUnit",
      validValues: VALID_AGE_UNITS,
    });
  }
  return normalizedValue;
}

function normalizeInteger(value, fieldName) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`, {
      field: fieldName,
    });
  }

  return parsedValue;
}

function getScopedWhere(user) {
  if (user.role === "SUPERADMIN") {
    return { isDeleted: false };
  }

  if (user.role === "LAB_ADMIN" || user.role === "LAB_TECH") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "User must be assigned to a laboratory before accessing patient records."
      );
    }

    return {
      laboratoryId: user.laboratoryId,
      isDeleted: false,
    };
  }

  throw new ApiError(403, "You are not authorized to access patient records.");
}

function buildPatientData(data) {
  const patientData = {};

  if (data.name !== undefined) {
    const name = normalizeString(data.name);

    if (!name) {
      throw new ApiError(400, "name is required.", { field: "name" });
    }

    patientData.name = name;
  }

  // Allow clearing optional fields (Fixes M6)
  if (data.fullName !== undefined) {
    const fullName = normalizeOptionalString(data.fullName);
    patientData.fullName = fullName ?? null;
  }

  if (data.phone !== undefined) {
    const phone = normalizeOptionalString(data.phone);
    patientData.phone = phone ?? null;
  }

  if (data.age !== undefined) {
    patientData.age = normalizeInteger(data.age, "age");
  }

  if (data.ageUnit !== undefined) {
    patientData.ageUnit = normalizeAgeUnit(data.ageUnit);
  }

  if (data.gender !== undefined) {
    const gender = normalizeGender(data.gender);

    if (!gender || !VALID_GENDERS.includes(gender)) {
      throw new ApiError(400, "gender must be one of MALE, FEMALE, or OTHER.", {
        field: "gender",
        validValues: VALID_GENDERS,
      });
    }

    patientData.gender = gender;
  }

  if (data.address !== undefined) {
    const address = normalizeOptionalString(data.address);
    patientData.address = address ?? null;
  }

  if (data.cnic !== undefined) {
    const cnic = normalizeOptionalString(data.cnic);
    patientData.cnic = cnic ?? null;
  }

  return patientData;
}

function handlePrismaError(error) {
  if (error?.code === "P2002") {
    throw new ApiError(
      409,
      "A patient with the same unique details (CNIC) already exists in this laboratory.",
      {
        fields: error.meta?.target ?? null,
      }
    );
  }

  if (error?.code === "P2003") {
    throw new ApiError(
      409,
      "This patient cannot be deleted because related medical records already exist.",
      {
        field: error.meta?.field_name ?? null,
      }
    );
  }

  if (error?.code === "P2025") {
    throw new ApiError(404, "Patient not found.");
  }

  throw error;
}

async function createPatient({ user, data }) {
  const scopedWhere = getScopedWhere(user);
  const patientData = buildPatientData(data);

  if (user.role === "LAB_ADMIN" || user.role === "LAB_TECH") {
    patientData.laboratoryId = user.laboratoryId;
  } else {
    const laboratoryId = normalizeString(data.laboratoryId);

    if (!laboratoryId) {
      throw new ApiError(400, "laboratoryId is required.", {
        field: "laboratoryId",
      });
    }

    assertUuid(laboratoryId, "laboratoryId");

    const laboratory = await prisma.laboratory.findUnique({
      where: { id: laboratoryId },
    });

    if (!laboratory) {
      throw new ApiError(404, "Laboratory not found.", {
        field: "laboratoryId",
      });
    }

    patientData.laboratoryId = laboratoryId;
  }

  if (!patientData.name) {
    throw new ApiError(400, "name is required.", { field: "name" });
  }

  if (patientData.age === undefined) {
    throw new ApiError(400, "age is required.", { field: "age" });
  }

  if (!patientData.gender) {
    throw new ApiError(400, "gender is required.", { field: "gender" });
  }

  try {
    const patient = await prisma.patient.create({
      data: {
        ...patientData,
      },
    });

    await recordAuditLog({
      laboratoryId: patient.laboratoryId,
      userId: user.id,
      action: "PATIENT_CREATED",
      entity: "Patient",
      entityId: patient.id,
      details: { name: patient.name, age: patient.age, gender: patient.gender },
    });

    return patient;
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listPatients({ user, query }) {
  const { page, limit } = parsePagination(query);
  const baseWhere = getScopedWhere(user);
  const skip = (page - 1) * limit;

  const where = { ...baseWhere };

  // Server search across name, fullName, cnic, phone (Fixes A7)
  if (query?.search) {
    const s = query.search.trim();
    where.AND = [
      {
        OR: [
          { name: { contains: s, mode: "insensitive" } },
          { fullName: { contains: s, mode: "insensitive" } },
          { cnic: { contains: s } },
          { phone: { contains: s } },
        ],
      },
    ];
  }

  const [patients, total] = await prisma.$transaction([
    prisma.patient.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.patient.count({
      where,
    }),
  ]);

  return {
    patients,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getPatientById({ user, patientId }) {
  assertUuid(patientId, "id");
  const where = {
    id: patientId,
    ...getScopedWhere(user),
  };

  const patient = await prisma.patient.findFirst({
    where,
  });

  if (!patient) {
    throw new ApiError(404, "Patient not found.");
  }

  return patient;
}

async function updatePatient({ user, patientId, data }) {
  assertUuid(patientId, "id");
  const where = {
    id: patientId,
    ...getScopedWhere(user),
  };

  const existingPatient = await prisma.patient.findFirst({ where });

  if (!existingPatient) {
    throw new ApiError(404, "Patient not found.");
  }

  const patientData = buildPatientData(data);

  if (Object.keys(patientData).length === 0) {
    throw new ApiError(400, "At least one patient field must be provided.");
  }

  try {
    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: patientData,
    });

    await recordAuditLog({
      laboratoryId: existingPatient.laboratoryId,
      userId: user.id,
      action: "PATIENT_UPDATED",
      entity: "Patient",
      entityId: patientId,
      details: patientData,
    });

    return updated;
  } catch (error) {
    handlePrismaError(error);
  }
}

async function deletePatient({ user, patientId }) {
  assertUuid(patientId, "id");
  const where = {
    id: patientId,
    ...getScopedWhere(user),
  };

  const patient = await prisma.patient.findFirst({
    where,
    include: {
      testOrders: {
        select: { id: true },
      },
    },
  });

  if (!patient) {
    throw new ApiError(404, "Patient not found.");
  }

  // Soft delete patient if order history exists to preserve audit integrity (Fixes A10)
  if (patient.testOrders && patient.testOrders.length > 0) {
    await prisma.patient.update({
      where: { id: patientId },
      data: { isDeleted: true },
    });

    await recordAuditLog({
      laboratoryId: patient.laboratoryId,
      userId: user.id,
      action: "PATIENT_SOFT_DELETED",
      entity: "Patient",
      entityId: patientId,
    });

    return { ...patient, isDeleted: true };
  }

  try {
    await prisma.patient.delete({
      where: { id: patientId },
    });

    await recordAuditLog({
      laboratoryId: patient.laboratoryId,
      userId: user.id,
      action: "PATIENT_DELETED",
      entity: "Patient",
      entityId: patientId,
    });
  } catch (error) {
    handlePrismaError(error);
  }

  return patient;
}

export {
  createPatient,
  listPatients,
  getPatientById,
  updatePatient,
  deletePatient,
};