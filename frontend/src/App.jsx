import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CsvWorkspace from "./pages/CsvWorkspace";
import ImageLabelingStudio from "./pages/ImageLabelingStudio";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={
            <ProtectedRoute><CsvWorkspace /></ProtectedRoute>
          } />
          <Route path="/image-labeling" element={
            <ProtectedRoute><ImageLabelingStudio /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;