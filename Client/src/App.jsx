import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute, { RequireRole } from "./components/ProtectedRoute";
import AppShell from "./layout/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients, { PatientForm, PatientDetail } from "./pages/Patients";
import Orders from "./pages/Orders";
import Results from "./pages/Results";
import Reports, { ReportDetail } from "./pages/Reports";
import Payments from "./pages/Payments";
import Laboratories, { LaboratoryForm, LaboratoryDetail } from "./pages/Laboratories";
import Users, { UserForm, UserDetail } from "./pages/Users";
export default function App() { return <Routes><Route path="/login" element={<Login />} /><Route element={<ProtectedRoute />}><Route element={<AppShell />}><Route path="/" element={<Dashboard />} /><Route path="/patients" element={<Patients />} /><Route path="/patients/new" element={<PatientForm />} /><Route path="/patients/:id" element={<PatientDetail />} /><Route path="/patients/:id/edit" element={<PatientForm />} /><Route path="/orders" element={<Orders />} /><Route path="/results" element={<Results />} /><Route path="/reports" element={<Reports />} /><Route path="/reports/:id" element={<ReportDetail />} /><Route path="/payments" element={<Payments />} /><Route element={<RequireRole role="SUPERADMIN" />}><Route path="/admin/laboratories" element={<Laboratories />} /><Route path="/admin/laboratories/new" element={<LaboratoryForm />} /><Route path="/admin/laboratories/:id" element={<LaboratoryDetail />} /><Route path="/admin/laboratories/:id/edit" element={<LaboratoryForm />} /><Route path="/admin/users" element={<Users />} /><Route path="/admin/users/new" element={<UserForm />} /><Route path="/admin/users/:id" element={<UserDetail />} /><Route path="/admin/users/:id/edit" element={<UserForm />} /></Route></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>; }
