import axios from 'axios';

// Configurable backend API base URL with fallback to local development port 5001
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch all buildings (optional filters: status, buildingType)
 */
export async function getBuildings(params = {}) {
  const response = await apiClient.get('/api/buildings', { params });
  return response.data;
}

/**
 * Fetch a single building by buildingId (e.g., 'BLD001')
 */
export async function getBuilding(buildingId) {
  const response = await apiClient.get(`/api/buildings/${encodeURIComponent(buildingId)}`);
  return response.data;
}

/**
 * Fetch rooms (optional filters: buildingId, block, floorNumber, roomType, prototype)
 */
export async function getRooms(params = {}) {
  const response = await apiClient.get('/api/rooms', { params });
  return response.data;
}

/**
 * Fetch a single room by roomNumber (e.g., 'C-102')
 */
export async function getRoom(roomNumber) {
  const response = await apiClient.get(`/api/rooms/${encodeURIComponent(roomNumber)}`);
  return response.data;
}

/**
 * Fetch timetables (optional filters: room, sectionId, day, type)
 */
export async function getTimetables(params = {}) {
  const response = await apiClient.get('/api/timetables', { params });
  return response.data;
}

/**
 * Fetch sections (optional filters: branch, semester, isActive)
 */
export async function getSections(params = {}) {
  const response = await apiClient.get('/api/sections', { params });
  return response.data;
}

/**
 * Fetch campus outdoor areas
 */
export async function getCampusAreas(params = {}) {
  const response = await apiClient.get('/api/campus-areas', { params });
  return response.data;
}

/**
 * Fetch active critical alerts
 */
export async function getAlerts(params = {}) {
  const response = await apiClient.get('/api/alerts', { params });
  return response.data;
}

/**
 * Fetch energy usage telemetry records
 */
export async function getEnergyUsage(params = {}) {
  const response = await apiClient.get('/api/energy-usage', { params });
  return response.data;
}

/**
 * Fetch live occupancy records
 */
export async function getOccupancy(params = {}) {
  const response = await apiClient.get('/api/occupancy', { params });
  return response.data;
}

/**
 * Fetch prioritized operational campus insights
 */
export async function getInsights(params = {}) {
  const response = await apiClient.get('/api/insights', { params });
  return response.data;
}

/**
 * Fetch campus congestion records
 */
export async function getCongestion(params = {}) {
  const response = await apiClient.get('/api/congestion', { params });
  return response.data;
}

/**
 * Fetch campus maintenance work orders
 */
export async function getMaintenance(params = {}) {
  const response = await apiClient.get('/api/maintenance', { params });
  return response.data;
}

/**
 * Fetch solar PV generation records and summaries from MongoDB Atlas
 */
export async function getSolarGeneration(params = {}) {
  const response = await apiClient.get('/api/solar-generation', { params });
  return response.data;
}

/**
 * Fetch solar PV summary KPI metrics
 */
export async function getSolarSummary() {
  const response = await apiClient.get('/api/solar-generation/summary');
  return response.data;
}

/**
 * Send inquiry to Unitwin AI Floating Assistant
 * @param {{ message: string, history?: Array<{ role: string, text: string }>, pageContext?: string }} payload
 */
export async function sendChatMessage(payload) {
  const response = await apiClient.post('/api/ai/chat', payload);
  return response.data;
}

/**
 * Fetch AI service configuration & readiness status
 */
export async function getAiStatus() {
  const response = await apiClient.get('/api/ai/status');
  return response.data;
}

export default apiClient;

