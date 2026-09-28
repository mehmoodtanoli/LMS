import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_GENDERS = ["MALE", "FEMALE", "OTHER"];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value) {
  const normalizedValue = normalizeString(value);
  return normalizedValue ? normalizedValue : undefined;
}

function normalizeGender(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  return normalizedValue || undefined;
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

function assertUuid(value, fieldName) {
  if (!UUID_PATTERN.test(value)) {
    throw new ApiError(400, `${fieldName} must be a valid UUID.`, {
      field: fieldName,
    });
  }
}

function getScopedWhere(user) {
  if (user.role === "SUPERADMIN") {
    return {};
  }

  if (user.role === "LAB_ADMIN") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "LAB_ADMIN users must be assigned to a laboratory before managing patients.",
      );
    }

    return {
      laboratoryId: user.laboratoryId,
    };
  }

  throw new ApiError(403, "You are not authorized to access patient records.");
}

function parsePagination(query) {
  const pageValue = query?.page ?? DEFAULT_PAGE;
  const limitValue = query?.limit ?? DEFAULT_LIMIT;
  const page = Number(pageValue);
  const limit = Number(limitValue);

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, "page must be a positive integer.", {
      field: "page",
    });
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new ApiError(400, "limit must be a positive integer.", {
      field: "limit",
    });
  }

  return {
    page,
    limit: Math.min(limit, MAX_LIMIT),
  };
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

  if (data.fullName !== undefined) {
    const fullName = normalizeOptionalString(data.fullName);

    if (data.fullName !== null && data.fullName !== undefined && !fullName) {
      throw new ApiError(400, "fullName cannot be empty if provided.", {
        field: "fullName",
      });
    }

    if (fullName !== undefined) {
      patientData.fullName = fullName;
    }
  }

  if (data.phone !== undefined) {
    const phone = normalizeOptionalString(data.phone);

    if (data.phone !== null && data.phone !== undefined && !phone) {
      throw new ApiError(400, "phone cannot be empty if provided.", {
        field: "phone",
      });
    }

    if (phone !== undefined) {
      patientData.phone = phone;
    }
  }

  if (data.age !== undefined) {
    patientData.age = normalizeInteger(data.age, "age");
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

    if (data.address !== null && data.address !== undefined && !address) {
      throw new ApiError(400, "address cannot be empty if provided.", {
        field: "address",
      });
    }

    if (address !== undefined) {
      patientData.address = address;
    }
  }

  if (data.cnic !== undefined) {
    const cnic = normalizeString(data.cnic);

    if (!cnic) {
      throw new ApiError(400, "cnic is required.", { field: "cnic" });
    }

    patientData.cnic = cnic;
  }

  return patientData;
}

function handlePrismaError(error) {
  if (error?.code === "P2002") {
    throw new ApiError(409, "A patient with the same unique details already exists.", {
      fields: error.meta?.target ?? null,
    });
  }

  if (error?.code === "P2003") {
    throw new ApiError(
      409,
      "This patient cannot be deleted because related records already exist.",
      {
        field: error.meta?.field_name ?? null,
      },
    );
  }

  if (error?.code === "P2025") {
    throw new ApiError(404, "Patient not found.");
  }

  throw error;
}

function getAccessiblePatientWhere(user) {
  return getScopedWhere(user);
}

async function createPatient({ user, data }) {
  const scopedWhere = getScopedWhere(user);
  const patientData = buildPatientData(data);

  if (user.role === "LAB_ADMIN") {
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

  if (!patientData.cnic) {
    throw new ApiError(400, "cnic is required.", { field: "cnic" });
  }

  try {
    return await prisma.patient.create({
      data: {
        ...scopedWhere,
        ...patientData,
      },
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listPatients({ user, query }) {
  const { page, limit } = parsePagination(query);
  const where = getAccessiblePatientWhere(user);
  const skip = (page - 1) * limit;

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
    ...getAccessiblePatientWhere(user),
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
    ...getAccessiblePatientWhere(user),
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
    return await prisma.patient.update({
      where: { id: patientId },
      data: patientData,
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

async function deletePatient({ user, patientId }) {
  assertUuid(patientId, "id");
  const where = {
    id: patientId,
    ...getAccessiblePatientWhere(user),
  };

  const patient = await prisma.patient.findFirst({
    where,
  });

  if (!patient) {
    throw new ApiError(404, "Patient not found.");
  }

  try {
    await prisma.patient.delete({
      where: { id: patientId },
    });
  } catch (error) {
    handlePrismaError(error);
  }

  return patient;
}

export { createPatient, listPatients, getPatientById, updatePatient, deletePatient };