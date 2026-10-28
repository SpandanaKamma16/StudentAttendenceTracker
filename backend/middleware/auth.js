const jwt = require("jsonwebtoken");
const supabase = require("../supabase");

const cookieName = () => process.env.SESSION_COOKIE_NAME || "attendance_session";

async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.[cookieName()];
    if (!token) return res.status(401).json({ error: "Please sign in to continue." });
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const { data: user, error } = await supabase.from("app_users")
      .select("id,name,email,role,student_number,department,is_active")
      .eq("id", payload.sub).maybeSingle();
    if (error) throw error;
    if (!user || !user.is_active) return res.status(401).json({ error: "Your account is inactive or no longer exists." });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError" || err.name === "NotBeforeError") {
      return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
    }
    next(err);
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "You do not have permission to perform this action." });
    next();
  };
}
module.exports = { authenticate, requireRole, cookieName };
