import {
  Box,
  Paper,
  Typography,
  Stack,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  FormControlLabel,
  SwipeableDrawer,
  Fab,
} from "@mui/material";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { useOutletContext } from "react-router-dom";
import { useState } from "react";

const safeTop = "calc(env(safe-area-inset-top, 0px) + 12px)";

export default function Tool1() {
  const { isMdUp, skinState, setSkinState } = useOutletContext();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const controlsText =
    "Controls: left mouse button to rotate, right mouse button to pan. Mouse wheel to zoom. Double click to focus. Control panel located on top left.";

  const {
    rows,
    showPatientCounts,
    showNodecodes,
    showDrainage,
  } = skinState;

  const setShowPatientCounts = (value) => {
    setSkinState((prev) => ({
      ...prev,
      showPatientCounts: value,
    }));
  };

  const setShowNodecodes = (value) => {
    setSkinState((prev) => ({
      ...prev,
      showNodecodes: value,
    }));
  };

  const setShowDrainage = (value) => {
    setSkinState((prev) => ({
      ...prev,
      showDrainage: value,
    }));
  };

  // Desktop: render only the sidebar content
  if (isMdUp) {
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <SidebarContent
          rows={rows}
          showPatientCounts={showPatientCounts}
          setShowPatientCounts={setShowPatientCounts}
          showNodecodes={showNodecodes}
          setShowNodecodes={setShowNodecodes}
          showDrainage={showDrainage}
          setShowDrainage={setShowDrainage}
          controlsText={controlsText}
        />
      </Box>
    );
  }

  // Mobile: floating button + bottom drawer
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
          Tool Info &amp; Tables
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
          {/* Pull handle */}
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

          {/* Drawer content */}
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <SidebarContent
              rows={rows}
              showPatientCounts={showPatientCounts}
              setShowPatientCounts={setShowPatientCounts}
              showNodecodes={showNodecodes}
              setShowNodecodes={setShowNodecodes}
              showDrainage={showDrainage}
              setShowDrainage={setShowDrainage}
              controlsText={controlsText}
            />
          </Box>
        </Box>
      </SwipeableDrawer>
    </>
  );
}

function SidebarContent({
  rows,
  showPatientCounts,
  setShowPatientCounts,
  showNodecodes,
  setShowNodecodes,
  showDrainage,
  setShowDrainage,
  controlsText,
}) {
  return (
    <>
      {/* Tool title and description */}
      <Paper variant="outlined" sx={{ m: 2, p: 2, borderRadius: 3 }}>
        <Typography variant="h2" sx={{ mb: 0.75 }}>
          Skin Selection Tool
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a surface element on the model to populate node-field statistics and visual overlays.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {controlsText}
        </Typography>
      </Paper>

      {/* Table area */}
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
          Lymphatic Drainage Statistics
        </Typography>

        <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Node Field</TableCell>
                <TableCell sx={{ fontWeight: 800 }}># Cases</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Mean Drainage %</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>95% CI</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ color: "text.secondary" }}>
                    Click an element to populate this table.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, idx) => (
                  <TableRow key={`${r.code}-${idx}`} hover>
                    <TableCell>{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.count}</TableCell>
                    <TableCell>{r.percentage}</TableCell>
                    <TableCell>{r.CI}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Display toggles */}
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
                checked={showPatientCounts}
                onChange={(e) => setShowPatientCounts(e.target.checked)}
              />
            }
            label="#Cases"
            sx={{ m: 0 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={showNodecodes}
                onChange={(e) => setShowNodecodes(e.target.checked)}
              />
            }
            label="Codes"
            sx={{ m: 0 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={showDrainage}
                onChange={(e) => setShowDrainage(e.target.checked)}
              />
            }
            label="Drainage %"
            sx={{ m: 0 }}
          />
        </Stack>
      </Paper>
    </>
  );
}