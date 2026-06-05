import { Navigate } from "react-router-dom";
import { getAuthToken } from "../config/api";

export default function ProtectedRoute({ children }) {
  const token = getAuthToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
