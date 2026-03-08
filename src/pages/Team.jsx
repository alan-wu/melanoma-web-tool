import { Box, Typography, Grid, Link, Avatar, Stack } from "@mui/material";

const teamMembers = [
  {
    name: "Hayley Reynolds, PhD",
    title: "Senior Research Fellow",
    organisation: "Auckland Bioengineering Institute",
    profileUrl: "https://profiles.auckland.ac.nz/hayley-reynolds",
    imageUrl: `${import.meta.env.BASE_URL}images/hayley.png`,
  },
  {
    name: "Tharanga Don, PhD",
    title: "Research Fellow",
    organisation: "Auckland Bioengineering Institute",
    profileUrl: "https://profiles.auckland.ac.nz/t-jayathungage-don",
    imageUrl: `${import.meta.env.BASE_URL}images/tharanga.png`,
  },
  {
    name: "David Chung, MD",
    title: "Nuclear Medicine Physician",
    organisation: "Alfred Nuclear Medicine and Ultrasound (ANMU) and University of Sydney",
    profileUrl: "",
    imageUrl: `${import.meta.env.BASE_URL}images/david.jpg`,
  },
  {
    name: "Roger Uren, MD",
    title: "Nuclear Medicine Physician",
    organisation: "University of Sydney",
    profileUrl: "https://linkedin.com/in/roger-uren-77199289",
    imageUrl: `${import.meta.env.BASE_URL}images/roger.png`,
  },
  {
    name: "Arnav Dogra",
    title: "Research Assistant",
    organisation: "University of Auckland",
    profileUrl: "https://linkedin.com/in/arnav-dogra",
    imageUrl: `${import.meta.env.BASE_URL}images/arnav.png`,
  },
];

export default function Team() {
  return (
    <Box
      sx={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        minHeight: {
          xs: "calc(100vh - 56px - 48px)",
          sm: "calc(100vh - 64px - 64px)",
        },
      }}
    >
      <Box>
        <Typography variant="h1" gutterBottom>
          Our Team
        </Typography>

        <Typography color="text.secondary" sx={{ maxWidth: 760, mx: "auto" }}>
          This melanoma tool has been developed by researchers in the Cancer Imaging Research Group at the Auckland Bioengineering Institute, University of Auckland, New Zealand.
          The melanoma lymphoscintigraphy data that has been used was collected at the Alfred Nuclear Medicine and Ultrasound in Sydney, Australia, over 30 years, between 1995 and 2025.
        </Typography>

        <Grid container spacing={2.5} sx={{ mt: 2 }} justifyContent="center">
          {teamMembers.map((m) => (
            <Grid
              key={`${m.name}-${m.title}`} // avoids duplicate key issues if names repeat
              item
              xs={12}
              sm={6}
              md={3}
              sx={{ display: "flex", justifyContent: "center" }}
            >
              <Link
                href={m.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                underline="none"
                sx={{
                  width: 340,
                  maxWidth: "100%",
                  display: "block",
                  borderRadius: 3,
                  "&:hover .teamCard": {
                    transform: "translateY(-2px)",
                    boxShadow: (theme) => theme.shadows[2],
                  },
                  "&:focus-visible .teamCard": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: "2px",
                  },
                }}
              >
                <Box
                  className="teamCard"
                  sx={{
                    height: "100%",
                    minHeight: 330, 
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 3,
                    p: 2,
                    transition: "transform 140ms ease, box-shadow 140ms ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    bgcolor: "background.paper",
                  }}
                >
                  <Avatar
                    alt={m.name}
                    src={m.imageUrl || undefined}
                    sx={{ width: 196, height: 196, fontWeight: 800 }}
                  >
                    {getInitials(m.name)}
                  </Avatar>

                  <Stack spacing={0.25} sx={{ alignItems: "center" }}>
                    <Typography sx={{ fontWeight: 750, color: "text.primary" }}>
                      {m.name}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                      {m.title}
                    </Typography>

                    {m.organisation ? (
                      <Typography variant="body2" color="text.secondary">
                        {m.organisation}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              </Link>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box sx={{ mt: "auto", pt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          General enquiries:{" "}
          <Link href="mailto:ABICONTACT@ABI.com" underline="hover">
            ABICONTACT@ABI.com
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}

function getInitials(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 2][0] : "";
  return (first + last).toUpperCase();
}
