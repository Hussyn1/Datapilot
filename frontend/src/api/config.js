// Default .NET API URL
// In launchSettings.json, DataPilot listens on both http://localhost:5044 and http://localhost:5157
export const DOTNET_URL = window.location.port === "5044" 
  ? "http://localhost:5044/api" 
  : "http://localhost:5044/api"; 

export const PYTHON_URL = "http://localhost:8000";