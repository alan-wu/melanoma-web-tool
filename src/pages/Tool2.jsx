import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Divider,
  Radio,
  SwipeableDrawer,
  useMediaQuery,
  Fab,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Switch,
} from "@mui/material";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";

import { useTheme } from "@mui/material/styles";

import ViewControls from "../components/ViewControls";
import CanvasControls from "../components/CanvasControls";
import HeatmapsViewer from "../components/HeatmapsViewer";

const safeTop = "calc(env(safe-area-inset-top, 0px) + 12px)";
const safeBottom = "calc(env(safe-area-inset-bottom, 0px) + 12px)";

// Sidebar resize bounds (desktop)
const MIN_SIDEBAR_W = 290;
const MAX_SIDEBAR_W = 720;
const DEFAULT_SIDEBAR_W = 520;

export default function Tool2() {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

  // Viewer API
  const apiRef = useRef(null);

  // Mobile drawer
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Desktop sidebar width (draggable)
  const [sidebarW, setSidebarW] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_SIDEBAR_W;
    const saved = Number(window.localStorage.getItem("tool2_sidebarW"));
    return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_SIDEBAR_W;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("tool2_sidebarW", String(sidebarW));
  }, [sidebarW]);

  // View preset
  const [viewPreset, setViewPreset] = useState("All");

  // Meta from engine (regions + discrete point keys)
  const [regions, setRegions] = useState([]);
  const [patientDataKeys, setPatientDataKeys] = useState([]);
  const [defaultRegion, setDefaultRegion] = useState("Right Axilla");

  // Heatmap selection state
  const [region, setRegion] = useState("Right Axilla");
  const [patientDataMode, setPatientDataMode] = useState("norm"); // "norm" | "freq"
  const [displaySites, setDisplaySites] = useState(true);

  const controlsText =
    "Controls: left mouse button to rotate, right mouse button to pan. Mouse wheel to zoom. Double click to focus. Control panel located on top left.";

  // view options
  const hasNorm = patientDataKeys.includes(region);
  const hasFreq = patientDataKeys.includes(`${region} Frequency`);

  // Autocorrect mode if user selects one that does not exist for this region
  useEffect(() => {
    if (patientDataMode === "freq" && !hasFreq && hasNorm) setPatientDataMode("norm");
    if (patientDataMode === "norm" && !hasNorm && hasFreq) setPatientDataMode("freq");
  }, [hasFreq, hasNorm, patientDataMode]);

  // If the currently selected region is not in the loaded regions list, fall back
  useEffect(() => {
    if (regions.length === 0) return;
    if (!regions.includes(region)) setRegion(defaultRegion || regions[0]);
  }, [regions, defaultRegion, region]);

  const handleReset = () => {
    setViewPreset("All");
    setRegion(defaultRegion);
    setPatientDataMode("norm");
    setDisplaySites(true);
    apiRef.current?.resetAll?.();
  };

  const selection = {
    region,
    patientDataMode,
    displaySites,
  };

  // Desktop resize handler
  const startResize = (e) => {
    if (!isMdUp) return;
    if (e.button !== 0) return;

    e.preventDefault();

    const startX = e.clientX;
    const startW = sidebarW;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev) => {
      const next = Math.min(
        MAX_SIDEBAR_W,
        Math.max(MIN_SIDEBAR_W, startW + (ev.clientX - startX))
      );
      setSidebarW(next);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const sections = useMemo(
    () => [
      {
        title: "Head and Neck",
        rows: [
          { type: "lr", label: "Occipital", left: "Left Occipital", right: "Right Occipital" },
          { type: "lr", label: "Preauricular", left: "Left Preauricular", right: "Right Preauricular" },
          { type: "lr", label: "Postauricular", left: "Left Postauricular", right: "Right Postauricular" },
          { type: "lr", label: "Cervical Level I", left: "Left Cervical Level I", right: "Right Cervical Level I" },
          { type: "lr", label: "Cervical Level II", left: "Left Cervical Level II", right: "Right Cervical Level II" },
          { type: "lr", label: "Cervical Level III", left: "Left Cervical Level III", right: "Right Cervical Level III" },
          { type: "lr", label: "Cervical Level IV", left: "Left Cervical Level IV", right: "Right Cervical Level IV" },
          { type: "lr", label: "Cervical Level V", left: "Left Cervical Level V", right: "Right Cervical Level V" },
          { type: "lr", label: "Submental", left: "Left Submental", right: "Right Submental" },
          { type: "single", label: "Anterior Node Fields", valueKey: "Anterior Head" },
          { type: "single", label: "Posterior Node Fields", valueKey: "Posterior Head" },
        ],
      },
      {
        title: "Torso and Upper Limb",
        rows: [
          { type: "lr", label: "Axilla Levels I, II, III", left: "Left Axilla", right: "Right Axilla" },
          { type: "lr", label: "Axilla Level I Anterior", left: "Left Axilla/Sub-Node Fields Laa", right: "Right Axilla/Sub-Node Fields Raa" },
          { type: "lr", label: "Axilla Level I Mid", left: "Left Axilla/Sub-Node Fields Lam", right: "Right Axilla/Sub-Node Fields Ram" },
          { type: "lr", label: "Axilla Level I Posterior", left: "Left Axilla/Sub-Node Fields Lap", right: "Right Axilla/Sub-Node Fields Rap" },
          { type: "lr", label: "Axilla Level I Lateral", left: "Left Axilla/Sub-Node Fields Lal", right: "Right Axilla/Sub-Node Fields Ral" },
          { type: "lr", label: "Triangular Intermuscular Space", left: "Left Triangular Intermuscular Space", right: "Right Triangular Intermuscular Space" },
          { type: "lr", label: "Supraclavicular Fossa", left: "Left Supraclavicular Fossa", right: "Right Supraclavicular Fossa" },
          { type: "lr", label: "Epitrochlear", left: "Left Epitrochlear", right: "Right Epitrochlear" },
        ],
      },
      {
        title: "Lower Limb",
        rows: [
          { type: "lr", label: "Groin (External Iliac, Femoral, Inguinal)", left: "Left Groin", right: "Right Groin" },
          { type: "lr", label: "External Iliac", left: "Left Groin/Sub-Node Fields Liei", right: "Right Groin/Sub-Node Fields Riei" },
          { type: "lr", label: "Femoral", left: "Left Groin/Sub-Node Fields Lif", right: "Right Groin/Sub-Node Fields Rif" },
          { type: "lr", label: "Inguinal", left: "Left Groin/Sub-Node Fields Lii", right: "Right Groin/Sub-Node Fields Rii" },
          { type: "lr", label: "Popliteal", left: "Left Popliteal", right: "Right Popliteal" },
        ],
      },
    ],
    []
  );


  const getDisplayRegionLabel = (value) => {
    for (const sec of sections) {
      for (const row of sec.rows) {
        if (row.type === "single" && row.valueKey === value) {
          return row.label;
        }

        if (row.type === "lr") {
          if (row.left === value) return `Left ${row.label}`;
          if (row.right === value) return `Right ${row.label}`;
        }
      }
    }

    if (value === "1 Draining Node Fields") return "1 Draining Node Field";
    if (value === "2 Or More Draining Node Fields") return "2+ Draining Node Fields";
    if (value === "3 Or More Draining Node Fields") return "3+ Draining Node Fields";
    if (value === "4 Or More Draining Node Fields") return "4+ Draining Node Fields";

    return value;
  };

  const selectedRegionLabel = getDisplayRegionLabel(region);


  return (
    <Box
      sx={{
        position: "relative",
        height: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" },
        width: "100%",
        display: { xs: "block", md: "grid" },
        gridTemplateColumns: { md: `${sidebarW}px 1fr` },
        overflow: "hidden",
      }}
    >
      {/* Left column (desktop) */}
      {isMdUp && (
        <Box
          sx={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            borderRight: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {/* Drag resize handle */}
          <Box
            onPointerDown={startResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize side panel"
            sx={{
              position: "absolute",
              top: 0,
              right: -4,
              width: 8,
              height: "100%",
              cursor: "col-resize",
              zIndex: 50,
              "&:hover": { bgcolor: "action.hover" },
            }}
          />

          <SidebarContent
            sections={sections}
            controlsText={controlsText}
            region={region}
            setRegion={setRegion}
            displaySites={displaySites}
            setDisplaySites={setDisplaySites}
            patientDataMode={patientDataMode}
            setPatientDataMode={setPatientDataMode}
            hasNorm={hasNorm}
            hasFreq={hasFreq}
            isMdUp={isMdUp}
          />
        </Box>
      )}

      {/* Right column */}
      <Box
        sx={{
          position: "relative",
          height: "100%",
          width: "100%",
          overflow: "hidden",
          isolation: "isolate",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <HeatmapsViewer
          selection={selection}
          viewPreset={viewPreset}
          onApiReady={(api) => (apiRef.current = api)}
          onMetaReady={(meta) => {
            setRegions(meta.regions);
            setPatientDataKeys(meta.patientDataKeys);
            setDefaultRegion(meta.defaultRegion);
            setRegion((prev) => (meta.regions.includes(prev) ? prev : meta.defaultRegion));
          }}
        />

        <CanvasControls
          onZoomIn={() => apiRef.current?.zoomIn?.()}
          onZoomOut={() => apiRef.current?.zoomOut?.()}
          onReset={handleReset}
        />
        <ViewControls value={viewPreset} onChange={setViewPreset} />
        {/* Overlay legend and selected region text on desktop, move legend to bottom on mobile */}
        {isMdUp && <HeatmapLegend overlay compact={false} />}
        <SelectedRegionOverlayText regionLabel={selectedRegionLabel} patientDataMode={patientDataMode} />

        {/* Mobile drawer button */}
        {!isMdUp && (
          <>
            <Box sx={{ position: "absolute", top: safeTop, left: 12, zIndex: 30 }}>
              <Fab
                variant="extended"
                size="small"
                onClick={() => setSidebarOpen(true)}
                sx={{
                  textTransform: "none",
                  borderRadius: 999,
                  boxShadow: "none",
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  color: "text.primary",
                  "&:hover": { bgcolor: "background.paper" },
                }}
              >
                <TableChartOutlinedIcon sx={{ mr: 1 }} />
                Tool Info &amp; Controls
              </Fab>
            </Box>

            <SwipeableDrawer
              anchor="bottom"
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              onOpen={() => setSidebarOpen(true)}
              disableSwipeToOpen
              swipeAreaWidth={24}
              hysteresis={0.25}
              minFlingVelocity={450}
              slotProps={{
                paper: {
                  sx: {
                    height: "70vh",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    overflow: "hidden",
                  },
                },
              }}
            >
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <Box sx={{ p: 1, display: "flex", justifyContent: "center" }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 4,
                      borderRadius: 999,
                      bgcolor: "text.disabled",
                    }}
                  />
                </Box>

                <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  <SidebarContent
                    sections={sections}
                    controlsText={controlsText}
                    region={region}
                    setRegion={setRegion}
                    displaySites={displaySites}
                    setDisplaySites={setDisplaySites}
                    patientDataMode={patientDataMode}
                    setPatientDataMode={setPatientDataMode}
                    hasNorm={hasNorm}
                    hasFreq={hasFreq}
                    isMdUp={isMdUp}
                  />
                </Box>
              </Box>
            </SwipeableDrawer>
          </>
        )}
      </Box>
    </Box>
  );
}

function SidebarContent({
  sections,
  controlsText,
  region,
  setRegion,
  displaySites,
  setDisplaySites,
  patientDataMode,
  setPatientDataMode,
  hasNorm,
  hasFreq,
  isMdUp,
}) {
  const SECTION_ROW_SX = { fontWeight: 800 };

  // Default options closed
  const [openSections, setOpenSections] = useState({
    "Head and Neck": false,
    "Torso and Upper Limb": false,
    "Lower Limb": false,
  });

  const toggle = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const sectionHasSelected = (sec) =>
    sec.rows.some((r) => (r.type === "single" ? r.valueKey === region : r.left === region || r.right === region));

  return (
    <>
      <Paper variant="outlined" sx={{ m: 2, p: 2, borderRadius: 3 }}>
        <Typography variant="h2" sx={{ mb: 0.75 }}>
          Heatmaps Tool
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a region from the drop down menu to colour the mesh according to the drainage likelihood of that region. Display options are available at the bottom of the control panel.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {controlsText}
        </Typography>
      </Paper>

      <Paper
        variant="outlined"
        sx={{
          mx: 2,
          mb: 2,
          p: 2,
          borderRadius: 3,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
        }}
      >
        <Typography sx={{ fontWeight: 800, mb: 1 }}>
          Heatmap selection
        </Typography>

        {/* Region table with collapsible sections */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Region</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Left
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Right
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {sections.map((sec) => {
                const open = Boolean(openSections[sec.title]);
                const isSelected = sectionHasSelected(sec);

                return (
                  <Fragment key={sec.title}>
                    {/* Section header row */}
                    <TableRow
                      hover
                      sx={{
                        cursor: "pointer",
                        bgcolor: isSelected ? "rgba(255,255,255,0.10)" : "transparent",
                        "&:hover": {
                          bgcolor: isSelected ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                        },
                        borderLeft: isSelected ? "3px solid" : "3px solid transparent",
                        borderLeftColor: isSelected ? "primary.main" : "transparent",
                      }}
                      onClick={() => toggle(sec.title)}
                    >
                      <TableCell sx={SECTION_ROW_SX}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(sec.title);
                            }}
                          >
                            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                          {sec.title}
                        </Box>
                      </TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>

                    {/* Child rows rendered in the same table */}
                    {open &&
                      sec.rows.map((r, idx) => {
                        if (r.type === "single") {
                          return (
                            <HeatmapSingleRow
                              key={`${sec.title}-single-${idx}`}
                              label={r.label}
                              valueKey={r.valueKey}
                              value={region}
                              onChange={setRegion}
                            />
                          );
                        }
                        return (
                          <HeatmapRow
                            key={`${sec.title}-lr-${idx}`}
                            label={r.label}
                            left={r.left}
                            right={r.right}
                            value={region}
                            onChange={setRegion}
                          />
                        );
                      })}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 2 }} />

        {/* Number of draining node fields */}
        <Typography sx={{ fontWeight: 800, mb: 1 }}>
          Number of draining node fields
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}># Node Fields</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>
                1
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>
                2+
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>
                3+
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>
                4+
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow hover>
              <TableCell />
              <TableCell align="center" onClick={() => setRegion("1 Draining Node Fields")} sx={{ cursor: "pointer" }}>
                <Radio checked={region === "1 Draining Node Fields"} />
              </TableCell>
              <TableCell align="center" onClick={() => setRegion("2 Or More Draining Node Fields")} sx={{ cursor: "pointer" }}>
                <Radio checked={region === "2 Or More Draining Node Fields"} />
              </TableCell>
              <TableCell align="center" onClick={() => setRegion("3 Or More Draining Node Fields")} sx={{ cursor: "pointer" }}>
                <Radio checked={region === "3 Or More Draining Node Fields"} />
              </TableCell>
              <TableCell align="center" onClick={() => setRegion("4 Or More Draining Node Fields")} sx={{ cursor: "pointer" }}>
                <Radio checked={region === "4 Or More Draining Node Fields"} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* Display sites and patient data mode*/}
      <Paper variant="outlined" sx={{ m: 2, p: 2, borderRadius: 3 }}>
        <Table size="small">
          <TableBody>
            <TableRow hover>
              <TableCell>Display melanoma sites</TableCell>
              <TableCell align="center">
                <Switch
                  checked={displaySites}
                  onChange={(e) => setDisplaySites(e.target.checked)}
                />
              </TableCell>
            </TableRow>

            <TableRow hover>
              <TableCell>Frequency</TableCell>
              <TableCell
                align="center"
                sx={{ cursor: hasFreq ? "pointer" : "default" }}
                onClick={() => hasFreq && setPatientDataMode("freq")}
              >
                <Radio checked={patientDataMode === "freq"} disabled={!hasFreq} />
              </TableCell>
            </TableRow>

            <TableRow hover>
              <TableCell>Normalised (% Drainage likelihood)</TableCell>
              <TableCell
                align="center"
                sx={{ cursor: hasNorm ? "pointer" : "default" }}
                onClick={() => hasNorm && setPatientDataMode("norm")}
              >
                <Radio checked={patientDataMode === "norm"} disabled={!hasNorm} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {!isMdUp && (
        <Paper variant="outlined" sx={{ m: 2, p: 2, borderRadius: 3 }}>
          <HeatmapLegend compact />
        </Paper>
      )}
    </>
  );
}

function HeatmapRow({ label, left, right, value, onChange }) {
  const isLeft = value === left;
  const isRight = value === right;

  return (
    <TableRow hover sx={{ cursor: "pointer" }}>
      <TableCell
        sx={{ pl: 6 }}
        onClick={() => onChange(value === left ? right : left)}
      >
        {label}
      </TableCell>

      <TableCell align="center" sx={{ px: 1 }} onClick={() => onChange(left)}>
        <Radio checked={isLeft} />
      </TableCell>

      <TableCell align="center" sx={{ px: 1 }} onClick={() => onChange(right)}>
        <Radio checked={isRight} />
      </TableCell>
    </TableRow>
  );
}

function HeatmapSingleRow({ label, valueKey, value, onChange }) {
  const checked = value === valueKey;

  return (
    <TableRow hover sx={{ cursor: "pointer" }} onClick={() => onChange(valueKey)}>
      <TableCell sx={{ pl: 6 }}>{label}</TableCell>
      <TableCell align="center" sx={{ px: 1 }}><Radio checked={checked} /></TableCell>
      <TableCell align="center" sx={{ px: 1 }}><Radio checked={checked} /></TableCell>
    </TableRow>
  );
}

function HeatmapLegend({ compact = false, overlay = false }) {
  return (
    <Paper
      variant={overlay ? "outlined" : "elevation"}
      elevation={0}
      sx={{
        ...(overlay
          ? {
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 25,
            pointerEvents: "none", // don't block 3D controls
            p: compact ? 1 : 1.25,
            borderRadius: 2.5,
            bgcolor: "background.paper",
            width: compact ? 180 : 260,
          }
          : {
            // don't look like a floating card
            position: "static",
            pointerEvents: "auto",
            width: "100%",
            maxWidth: "100%",
            bgcolor: "transparent",
            border: "none",
            boxShadow: "none",
            p: 0,
            borderRadius: 0,
          }),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          0%
        </Typography>
        <Typography
          variant="caption"
          sx={{ flex: 1, textAlign: "center", fontWeight: 700 }}
        >
          % Drainage likelihood
        </Typography>
        <Typography variant="caption" color="text.secondary">
          100%
        </Typography>
      </Box>

      <Box
        sx={{
          height: compact ? 12 : 14,
          borderRadius: 999,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: "100%",
            background:
              "linear-gradient(90deg, #0033ff 0%, #00d5ff 25%, #00ff66 50%, #ffe600 75%, #ff2a00 100%)",
          }}
        />
      </Box>
    </Paper>
  );
}

function SelectedRegionOverlayText({ regionLabel, patientDataMode }) {
  const modeLabel = patientDataMode === "freq" ? "Frequency" : "Normalised";

  return (
    <Typography
      variant="body2"
      sx={{
        position: "absolute",
        left: "50%",
        bottom: 12,
        transform: "translateX(-50%)",
        zIndex: 26,
        fontWeight: 700,
        pointerEvents: "none",
        maxWidth: "calc(100% - 24px)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      Region: {regionLabel} | {modeLabel}
    </Typography>
  );
}