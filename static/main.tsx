import React from "react";
import ReactDOM from "react-dom/client";
import { MindMapApp } from "../app/MindMapApp";
import "../app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><MindMapApp /></React.StrictMode>,
);
