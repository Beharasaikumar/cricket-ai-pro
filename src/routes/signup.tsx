import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user"); // default

  const signup = async () => {
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, role }),
      });

      alert("Signup successful! Please login.");
      nav({ to: "/login" });
    } catch (e) {
      alert("Signup failed");
    }
  };

  return (
    <div className="p-10 max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Signup</h1>

      <input
        placeholder="Email"
        className="border p-2 w-full"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        className="border p-2 w-full"
        onChange={(e) => setPassword(e.target.value)}
      />

      {/* ROLE SELECT */}
      <select
        className="border p-2 w-full"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>

      <button onClick={signup} className="bg-black text-white px-4 py-2 w-full">
        Signup
      </button>

      <p className="text-sm text-center">
        Already have an account?{" "}
        <a href="/login" className="underline">Login</a>
      </p>
    </div>
  );
}