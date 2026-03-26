
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import 'maplibre-gl/dist/maplibre-gl.css';

  createRoot(document.getElementById("root")!).render(<App />);
  