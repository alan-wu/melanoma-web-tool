import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Divider,
  Radio,
  SwipeableDrawer,
  Fab,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Checkbox,
  Stack,
  FormControlLabel,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { useOutletContext } from "react-router-dom";

const safeTop = "calc(env(safe-area-inset-top, 0px) + 12px)";

export default function Tool2() {
  const { isMdUp, heatmapState, setHeatmapState } = useOutletContext();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const controlsText =
    "Controls: left mouse button to rotate, right mouse button to pan. Mouse wheel to zoom. Double click to focus. Control panel located on top left.";

  const {
    region,
    pointDisplayMode,
    regions,
    defaultRegion,
  } = heatmapState;

  useEffect(() => {
    if (regions.length === 0) return;

    if (!regions.includes(region)) {
      setHeatmapState((prev) => ({
        ...prev,
        region: defaultRegion || regions[0],
      }));
    }
  }, [regions, defaultRegion, region, setHeatmapState]);

  const setRegion = (value) => {
    setHeatmapState((prev) => ({
      ...prev,
      region: value,
    }));
  };

  const setPointDisplayMode = (value) => {
    setHeatmapState((prev) => ({
      ...prev,
      pointDisplayMode: value,
    }));
  };

  const melanomaSitesChecked = pointDisplayMode === "sites";
  const normalisedChecked = pointDisplayMode === "normalised";

  const handleToggleMelanomaSites = () => {
    setPointDisplayMode(melanomaSitesChecked ? "none" : "sites");
  };

  const handleToggleNormalised = () => {
    setPointDisplayMode(normalisedChecked ? "none" : "normalised");
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

  if (isMdUp) {
    return (
      <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <SidebarContent
          sections={sections}
          controlsText={controlsText}
          region={region}
          setRegion={setRegion}
          melanomaSitesChecked={melanomaSitesChecked}
          normalisedChecked={normalisedChecked}
          handleToggleMelanomaSites={handleToggleMelanomaSites}
          handleToggleNormalised={handleToggleNormalised}
          isMdUp={isMdUp}
        />
      </Box>
    );
  }

  return (
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
              melanomaSitesChecked={melanomaSitesChecked}
              normalisedChecked={normalisedChecked}
              handleToggleMelanomaSites={handleToggleMelanomaSites}
              handleToggleNormalised={handleToggleNormalised}
              isMdUp={isMdUp}
            />
          </Box>
        </Box>
      </SwipeableDrawer>
    </>
  );
}

function SidebarContent({
  sections,
  controlsText,
  region,
  setRegion,
  melanomaSitesChecked,
  normalisedChecked,
  handleToggleMelanomaSites,
  handleToggleNormalised,
  isMdUp,
}) {
  const SECTION_ROW_SX = { fontWeight: 800 };

  const [openSections, setOpenSections] = useState({
    "Head and Neck": false,
    "Torso and Upper Limb": false,
    "Lower Limb": false,
  });

  const toggle = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const sectionHasSelected = (sec) =>
    sec.rows.some((r) =>
      r.type === "single"
        ? r.valueKey === region
        : r.left === region || r.right === region
    );

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
              <TableCell
                align="center"
                onClick={() => setRegion("1 Draining Node Fields")}
                sx={{ cursor: "pointer" }}
              >
                <Radio checked={region === "1 Draining Node Fields"} />
              </TableCell>
              <TableCell
                align="center"
                onClick={() => setRegion("2 Or More Draining Node Fields")}
                sx={{ cursor: "pointer" }}
              >
                <Radio checked={region === "2 Or More Draining Node Fields"} />
              </TableCell>
              <TableCell
                align="center"
                onClick={() => setRegion("3 Or More Draining Node Fields")}
                sx={{ cursor: "pointer" }}
              >
                <Radio checked={region === "3 Or More Draining Node Fields"} />
              </TableCell>
              <TableCell
                align="center"
                onClick={() => setRegion("4 Or More Draining Node Fields")}
                sx={{ cursor: "pointer" }}
              >
                <Radio checked={region === "4 Or More Draining Node Fields"} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      <Paper variant="outlined" sx={{ m: 2, p: 2, borderRadius: 3 }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
        >
          <Typography sx={{ fontWeight: 700 }}>
            Display:
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={melanomaSitesChecked}
                onChange={handleToggleMelanomaSites}
              />
            }
            label="Melanoma sites"
            sx={{ m: 0 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={normalisedChecked}
                onChange={handleToggleNormalised}
              />
            }
            label="Normalised"
            sx={{ m: 0 }}
          />
        </Stack>
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
      <TableCell align="center" sx={{ px: 1 }}>
        <Radio checked={checked} />
      </TableCell>
      <TableCell align="center" sx={{ px: 1 }}>
        <Radio checked={checked} />
      </TableCell>
    </TableRow>
  );
}

function HeatmapLegend({ compact = false }) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: "static",
        pointerEvents: "auto",
        width: "100%",
        maxWidth: "100%",
        bgcolor: "transparent",
        border: "none",
        boxShadow: "none",
        p: 0,
        borderRadius: 0,
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