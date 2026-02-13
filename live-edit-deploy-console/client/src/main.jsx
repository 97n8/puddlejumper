import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";

import App from "./App.jsx";
import "./styles.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

function AppRoot() {
  return (
    <React.StrictMode>
      <ClerkProvider publishableKey={publishableKey}>
        <SignedIn>
          <App />
        </SignedIn>
        <SignedOut>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
          </div>
        </SignedOut>
      </ClerkProvider>
    </React.StrictMode>
  );
}

createRoot(document.getElementById("root")).render(<AppRoot />);
