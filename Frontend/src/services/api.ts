import axios from "axios";

// Axios instance — all requests go through the Vite dev proxy (/api → localhost:5000)
// In production, replace baseURL with the deployed backend URL
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
