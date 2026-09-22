import prisma from "../config/prisma.js";
import ApiResponse from "../utils/ApiResponse.js";

const getSummary = async (req, res) => {
  const [
    totalLaboratories,
    activeLaboratories,
    totalUsers,
    activeUsers,
    totalPatients,
    recentLaboratories,
  ] = await prisma.$transaction([
    prisma.laboratory.count(),
    prisma.laboratory.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.patient.count(),
    prisma.laboratory.findMany({
      select: { id: true, name: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const response = new ApiResponse(200, "Dashboard summary fetched.", {
    totalLaboratories,
    activeLaboratories,
    totalUsers,
    activeUsers,
    totalPatients,
    recentLaboratories,
  });

  return res.status(200).json(response);
};

export { getSummary };
