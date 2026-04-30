// Public entry point for the feedback layer.
//
// IMPORTANT: To enable, add `VITE_ENABLE_FEEDBACK=true` to .env.local at the
// project root. When the flag is not "true", consumers must NOT statically
// import this module — use dynamic import in __root.tsx so the entire feature
// (and any future deps like @dnd-kit) is tree-shaken from production builds.
//
//   const FeedbackProvider = import.meta.env.VITE_ENABLE_FEEDBACK === "true"
//     ? lazy(() => import("@/features/feedback").then(m => ({ default: m.FeedbackProvider })))
//     : null;

export { FeedbackProvider } from "./components/FeedbackProvider";
