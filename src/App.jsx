import { Routes, Route, Navigate } from "react-router-dom";
import { Box, Container } from "@mui/material";

import Navbar from "./components/Navbar.jsx";
import FloatingLogo from "./components/FloatingLogo.jsx";

import Home from "./pages/Home.jsx";
import ToolsLayout from "./pages/ToolsLayout.jsx";
import Tool1 from "./pages/Tool1.jsx";
import Tool2 from "./pages/Tool2.jsx";
import Team from "./pages/Team.jsx";


/**
 * Root application component.
 * It defines the top level page structure, shared navigation,
 * route configuration, and the persistent floating logo overlay.
 *
 * @returns {JSX.Element} The rendered application shell.
 */
export default function App() {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <Navbar title="Melanoma Lymphatic Pathways" />

      {/* Main content area that swaps pages based on the current route. */}
      <Box component="main" sx={{ flex: 1, minHeight: 0, width: "100%" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Nested tool routes share the same responsive viewer/layout shell. */}
          <Route element={<ToolsLayout />}>
            <Route path="/tool1" element={<Tool1 />} />
            <Route path="/tool2" element={<Tool2 />} />
          </Route>
          <Route path="/team" element={<Team />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {/* Persistent ABIlogo shown across all routes without blocking interaction. */}
        <FloatingLogo src={`${import.meta.env.BASE_URL}images/abilogo.png`} />

      </Box>
    </Box>
  );
}
