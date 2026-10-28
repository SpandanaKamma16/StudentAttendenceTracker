const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../supabase");
const { authenticate, cookieName } = require("../middleware/auth");
const { asyncRoute } = require("../utils/errors");
const router = express.Router();
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 * 1000 });

router.post("/login", asyncRoute(async (req,res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = req.body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 1 || password.length > 200)
    return res.status(400).json({ error: "Enter a valid email address and password." });
  const { data: user, error } = await supabase.from("app_users")
    .select("id,name,email,role,student_number,department,password_hash,is_active")
    .eq("email", email).maybeSingle();
  if (error) throw error;
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "Email or password is incorrect." });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "8h", issuer: "students-attendance-tracker", audience: "attendance-web" });
  res.cookie(cookieName(), token, cookieOptions());
  res.json({ user: publicUser(user) });
}));
router.get("/me", authenticate, (req,res) => res.json({ user: publicUser(req.user) }));
router.post("/logout", (req,res) => { res.clearCookie(cookieName(), { httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"strict", path:"/" }); res.json({ message:"Signed out." }); });
function publicUser(user) { return { id:user.id, name:user.name, email:user.email, role:user.role, student_number:user.student_number, department:user.department }; }
module.exports = router;
