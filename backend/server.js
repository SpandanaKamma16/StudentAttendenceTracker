require("dotenv").config();
const path=require("path");
const express=require("express");
const helmet=require("helmet");
const cookieParser=require("cookie-parser");
const rateLimit=require("express-rate-limit");
const bcrypt=require("bcryptjs");
const supabase=require("./supabase");
const {authenticate,requireRole}=require("./middleware/auth");
const authRoutes=require("./routes/auth");
const adminRoutes=require("./routes/admin");
const teacherRoutes=require("./routes/teacher");
const studentRoutes=require("./routes/student");

if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error("JWT_SECRET must be set to a random secret of at least 32 characters.");
const app=express();
app.disable("x-powered-by");
app.use(helmet({contentSecurityPolicy:{directives:{"default-src":["'self'"],"script-src":["'self'"],"style-src":["'self'"],"img-src":["'self'","data:"],"connect-src":["'self'"],"object-src":["'none'"],"base-uri":["'self'"],"frame-ancestors":["'none'"]}}}));
app.use(express.json({limit:"100kb"}));
app.use(cookieParser());
app.use((req,res,next)=>{
 if(["POST","PUT","PATCH","DELETE"].includes(req.method)){
  const origin=req.get("origin");
  const allowed=process.env.APP_ORIGIN||`http://localhost:${process.env.PORT||3000}`;
  if(origin&&origin!==allowed)return res.status(403).json({error:"Request origin is not allowed."});
 }
 next();
});
app.get("/api/health",(req,res)=>res.json({status:"ok",service:"students-attendance-tracker",timestamp:new Date().toISOString()}));
app.use("/api/auth",rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:"draft-8",legacyHeaders:false,message:{error:"Too many login attempts. Wait 15 minutes and try again."}}),authRoutes);
app.use("/api/admin",authenticate,requireRole("admin"),adminRoutes);
app.use("/api/teacher",authenticate,requireRole("teacher"),teacherRoutes);
app.use("/api/student",authenticate,requireRole("student"),studentRoutes);
app.use("/api", (req,res)=>res.status(404).json({error:"API endpoint not found."}));
app.use(express.static(path.join(__dirname,"..","frontend"),{index:"index.html",dotfiles:"deny"}));
app.use((err,req,res,next)=>{
 console.error(`[${new Date().toISOString()}]`,err.message);
 if(res.headersSent)return next(err);
 res.status(500).json({error:"An unexpected server error occurred. Check the server terminal for details."});
});
async function bootstrapAdmin(){
 const email=String(process.env.BOOTSTRAP_ADMIN_EMAIL||"").trim().toLowerCase();
 const password=process.env.BOOTSTRAP_ADMIN_PASSWORD||"";
 if(!email||!password){console.warn("Bootstrap admin not configured. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in backend/.env.");return;}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12)throw new Error("Bootstrap admin email must be valid and its password must contain at least 12 characters.");
 const found=await supabase.from("app_users").select("id").eq("email",email).maybeSingle();if(found.error)throw found.error;
 if(found.data){console.log("Bootstrap administrator already exists; no account changes made.");return;}
 const {error}=await supabase.from("app_users").insert({name:"System Administrator",email,role:"admin",password_hash:await bcrypt.hash(password,12),is_active:true});
 if(error)throw error;
 console.log(`Bootstrap administrator created for ${email}. Change the temporary password after first login using a secure administrative process.`);
}
const port=Number(process.env.PORT||3000);
if(require.main===module){bootstrapAdmin().then(()=>app.listen(port,()=>console.log(`Students Attendance Tracker running at http://localhost:${port}`))).catch(err=>{console.error("Startup failed:",err.message);process.exit(1);});}
module.exports=app;
