# Melanoma Lymphatic Pathways Web Tool

A React + Vite + Three.js web application for exploring melanoma lymphatic pathway data through two interactive 3D tools:


## Tech stack (Programming languages/ tools used)

- **React**
- **Vite**
- **React Router**
- **MUI**
- **Three.js**
- **ArcballControls**
- **CSS2DRenderer**
- **GitHub Pages** for deployment



# Installation and setup for making future changes

## 1. Install Node.js and npm

Install the latest **LTS version of Node.js** from the official Node.js website.

Node.js usually includes **npm** automatically.

Check installation:

```bash
node -v
npm -v
```

If both commands return versions, Node.js and npm are installed correctly.

---

## 2. Install Git

Install Git and check:

```bash
git --version
```

---

## 3. Clone the repository

```bash
git clone <your-repository-url>
cd WEBTOOL
```

---

## 4. Install project dependencies

From the project root:

```bash
npm install
```

This installs all dependencies listed in `package.json`.

---

## 5. Start the local development server

```bash
npm run dev
```

Vite should print a local URL, usually something like:

```text
http://localhost:5173/
```

Open that in your browser.





# How to work on this project


### Start development server
```bash
npm run dev
```

### Edit React UI files
Most panel/UI changes happen in:
- `src/pages/Tool1.jsx`
- `src/pages/Tool2.jsx`
- `src/pages/ToolsLayout.jsx`
- `src/components/*`

### Edit 3D behaviour
Most 3D logic changes happen in:
- `src/three/Base3DEngine.js`
- `src/three/SharedBodyEngine.js`
- `src/three/AnatomyShellLayer.js`
- `src/three/SkinSelectionLayer.js`
- `src/three/HeatmapLayer.js`



# File-by-file explanation

## Root files

### `.gitignore`
Specifies files and folders Git should ignore, such as:
- `node_modules`
- build outputs
- temporary files

### `package.json`
Defines:
- project metadata
- scripts
- dependencies
- dev dependencies

### `package-lock.json`
Locks exact package versions for consistent installs.

---

## GitHub Actions

### `.github/workflows/`
Contains GitHub Actions workflows.

Typical uses:
- automatic deploy to GitHub Pages
- build checks on push
- CI workflows

If this project is deployed automatically, the Pages deployment workflow will be here.

---

## Public assets

### `public/data/`
Contains static data files used directly by the 3D tools.

Files include:
- `scene.glb`
- `human_mesh.glb`
- `lymphs_positions.json`
- `data_elements.json`
- `element_patient_counts.json`
- `heat_maps_verts_colors.json`
- `discrete_points_normalized.json`

These are loaded at runtime using fetch or Three.js loaders.


### `public/images/`
Contains team member images


## `src/main.jsx`
Application entry point.

Responsibilities:
- bootstraps React
- attaches the app to the DOM
- usually wraps the app with routing and theme providers

---

## `src/App.jsx`
Main app layout and route definitions.

Responsibilities:
- renders the overall page shell
- renders the navbar
- defines routes for:
  - Home
  - Team
  - Tool 1
  - Tool 2
  - ToolsLayout parent route



## `src/theme.js`
Defines the MUI theme used across the project.

Responsibilities:
- palette
- typography
- spacing/styling consistency



## `src/App.css`
Global  app level CSS styles.

### `src/index.css`
Base global CSS styles applied to the full application.



# Components

## `src/components/Navbar.jsx`
Top navigation bar for the site.

Responsibilities:
- site title
- navigation links
- top-level navigation styling

## `src/components/CanvasControls.jsx`
Floating canvas control buttons.

Responsibilities:
- zoom in
- zoom out
- reset

These controls interact with the shared 3D viewer engine.

## `src/components/ViewControls.jsx`
Floating view preset control.

Responsibilities:
- switch between view presets such as:
  - All
  - Anterior
  - Posterior
  - Left
  - Right

## `src/components/FloatingLogo.jsx`
Floating logo image component.

Responsibilities:
- places a logo in a fixed screen position


## `src/components/SharedBodyViewer.jsx`
React wrapper around the shared Three.js engine.

Responsibilities:
- creates the shared 3D engine
- keeps the viewer mounted while switching tools
- passes Tool 1 / Tool 2 state into the engine
- exposes engine API back to React for zoom/reset actions


# Pages

## `src/pages/Home.jsx`
Homepage of the web tool.

Responsibilities:
- introduction
- links to Tool 1, Tool 2, and Team
- previous reserach

## `src/pages/Team.jsx`
Team  page.

Responsibilities:
- show team members
- project affiliations
- acknowledgements

## `src/pages/ToolsLayout.jsx`
Shared parent layout for Tool 1 and Tool 2.

Responsibilities:
- renders the shared viewer once
- stores shared UI state
- renders common controls
- provides panel state to nested pages
- keeps camera/view state when switching tools


## `src/pages/Tool1.jsx`
UI panel for the Skin Selection Tool.

Responsibilities:
- shows Tool 1 title and instructions
- shows drainage statistics table
- shows display toggles
- supports desktop sidebar and mobile drawer modes

## `src/pages/Tool2.jsx`
UI panel for the Heatmaps Tool.

Responsibilities:
- shows Tool 2 title and instructions
- shows region selection UI
- shows draining node field controls
- shows overlay toggles such as melanoma sites / normalised
- supports desktop sidebar and mobile drawer modes



## Three.js engine files

### `src/three/Base3DEngine.js`
Base engine shared by the 3D system.

**Responsibilities:**
- Create the scene
- Create the camera
- Create the renderer
- Create `ArcballControls`
- Handle resize logic
- Handle the animation loop
- Provide common zoom and view preset mechanics



### `src/three/SharedBodyEngine.js`
Main shared 3D engine for both tools.

**Responsibilities:**
- Extend `Base3DEngine`
- Initialise the shared anatomy shell
- Initialise Tool 1 and Tool 2 layers
- Handle active tool switching
- Manage shared element selection state across both tools
- Coordinate common camera behaviour across both tools



### `src/three/AnatomyShellLayer.js`
Shared anatomy shell layer.

**Responsibilities:**
- Load the shared body model from `scene.glb`
- Build selectable body meshes
- Rebuild and render the boundary line overlay
- Store shared selected mesh state
- Provide selected-mesh focus information
- Control selection visuals differently for Tool 1 and Tool 2



### `src/three/SkinSelectionLayer.js`
Tool 1-specific layer.

**Responsibilities:**
- Load lymph node data
- Load body element statistics
- Show Tool 1 node spheres and labels
- Update table rows
- Manage Tool 1-specific overlays and label visibility
- React to shared body selection state to update Tool 1 UI


### `src/three/HeatmapLayer.js`
Tool 2-specific layer.

**Responsibilities:**
- Load heatmap mesh
- Load vertex colour data
- Load melanoma site / normalised point datasets
- Render heatmaps
- Render point overlays
- Expose region metadata back to the UI



### `src/three/ThreeLabels.css`
CSS used for the CSS2D labels in Tool 1.

**Responsibilities:**
- Style lymph labels
- Style tooltip labels
- Control label visibility classes

This file supports the label rendering used by `SkinSelectionLayer`.



# Hosting on GitHub Pages

Please follow the latest guidelines based on these links

https://vite.dev/guide/static-deploy

https://github.com/gitname/react-gh-pages
