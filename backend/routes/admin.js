const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../supabase");
const { asyncRoute, databaseError, validUUID } = require("../utils/errors");
const router = express.Router();
router.use((req,res,next)=>next());
const run = asyncRoute;

router.get("/overview", run(async(req,res)=>{
  const [usersR,classesR,recordsR,enrollR]=await Promise.all([
    supabase.from("app_users").select("id,name,email,role,student_number,department,is_active").eq("is_active",true).order("name"),
    supabase.from("classes").select("id,name,code,teacher_id,teacher:app_users!classes_teacher_id_fkey(name)").order("name"),
    supabase.from("attendance_records").select("id",{count:"exact",head:true}),
    supabase.from("enrollments").select("class_id")
  ]);
  for(const r of [usersR,classesR,recordsR,enrollR])if(r.error)throw r.error;
  const counts={};for(const e of enrollR.data)counts[e.class_id]=(counts[e.class_id]||0)+1;
  const classes=classesR.data.map(c=>({id:c.id,name:c.name,code:c.code,teacher_id:c.teacher_id,teacher_name:c.teacher?.name||null,enrolled_count:counts[c.id]||0}));
  res.json({stats:{students:usersR.data.filter(u=>u.role==="student").length,teachers:usersR.data.filter(u=>u.role==="teacher").length,classes:classes.length,records:recordsR.count||0},users:usersR.data,classes});
}));
router.post("/users",run(async(req,res)=>{
  const {name,email,role,password,student_number,department}=req.body;
  if(typeof name!=="string"||name.trim().length<2||name.trim().length>100)return res.status(400).json({error:"Name must contain 2–100 characters."});
  const cleanEmail=String(email||"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))return res.status(400).json({error:"Enter a valid email address."});
  if(!["student","teacher"].includes(role))return res.status(400).json({error:"Role must be student or teacher."});
  if(typeof password!=="string"||password.length<10||password.length>100)return res.status(400).json({error:"Temporary password must be 10–100 characters."});
  if(role==="student"&&(!student_number||String(student_number).trim().length<1))return res.status(400).json({error:"Student ID is required for students."});
  const password_hash=await bcrypt.hash(password,12);
  const {data,error}=await supabase.from("app_users").insert({name:name.trim(),email:cleanEmail,role,password_hash,student_number:role==="student"?String(student_number).trim():null,department:department?String(department).trim().slice(0,100):null}).select("id,name,email,role,student_number").single();
  if(error){const e=databaseError(error);return res.status(e.status).json({error:e.message});}
  res.status(201).json({user:data});
}));
router.patch("/users/:id/password",run(async(req,res)=>{
  if(!validUUID(req.params.id))return res.status(400).json({error:"Invalid user ID."});
  const p=req.body.password;if(typeof p!=="string"||p.length<10||p.length>100)return res.status(400).json({error:"Password must be 10–100 characters."});
  const {data,error}=await supabase.from("app_users").update({password_hash:await bcrypt.hash(p,12)}).eq("id",req.params.id).neq("role","admin").select("id").maybeSingle();
  if(error)throw error;if(!data)return res.status(404).json({error:"User not found or administrator password cannot be reset here."});
  res.json({message:"Password updated."});
}));
router.delete("/users/:id",run(async(req,res)=>{
  if(!validUUID(req.params.id))return res.status(400).json({error:"Invalid user ID."});
  if(req.params.id===req.user.id)return res.status(400).json({error:"You cannot delete your own administrator account."});
  const {data,error}=await supabase.from("app_users").delete().eq("id",req.params.id).neq("role","admin").select("id").maybeSingle();
  if(error){const e=databaseError(error);return res.status(e.status).json({error:e.message});}if(!data)return res.status(404).json({error:"User not found or administrator accounts cannot be deleted here."});
  res.json({message:"User deleted."});
}));
router.post("/classes",run(async(req,res)=>{
  const {name,code,teacher_id}=req.body;
  if(typeof name!=="string"||name.trim().length<2||name.trim().length>120)return res.status(400).json({error:"Class name must contain 2–120 characters."});
  if(typeof code!=="string"||!/^[A-Za-z0-9_-]{2,20}$/.test(code.trim()))return res.status(400).json({error:"Class code must be 2–20 letters, numbers, hyphens or underscores."});
  let teacher=null;if(teacher_id){if(!validUUID(teacher_id))return res.status(400).json({error:"Invalid teacher ID."});const r=await supabase.from("app_users").select("id").eq("id",teacher_id).eq("role","teacher").eq("is_active",true).maybeSingle();if(r.error)throw r.error;if(!r.data)return res.status(400).json({error:"Select an active teacher account."});teacher=teacher_id;}
  const {data,error}=await supabase.from("classes").insert({name:name.trim(),code:code.trim().toUpperCase(),teacher_id:teacher}).select("id,name,code,teacher_id").single();
  if(error){const e=databaseError(error);return res.status(e.status).json({error:e.message});}res.status(201).json({class:data});
}));
router.delete("/classes/:id",run(async(req,res)=>{
  if(!validUUID(req.params.id))return res.status(400).json({error:"Invalid class ID."});
  const {data,error}=await supabase.from("classes").delete().eq("id",req.params.id).select("id").maybeSingle();
  if(error){const e=databaseError(error);return res.status(e.status).json({error:e.message});}if(!data)return res.status(404).json({error:"Class not found."});res.json({message:"Class deleted."});
}));
router.post("/classes/:id/enrollments",run(async(req,res)=>{
  const classId=req.params.id,studentId=req.body.student_id;if(!validUUID(classId)||!validUUID(studentId))return res.status(400).json({error:"Choose a valid class and student."});
  const [c,s]=await Promise.all([supabase.from("classes").select("id").eq("id",classId).maybeSingle(),supabase.from("app_users").select("id").eq("id",studentId).eq("role","student").eq("is_active",true).maybeSingle()]);
  if(c.error)throw c.error;if(s.error)throw s.error;if(!c.data||!s.data)return res.status(400).json({error:"Class or student account was not found."});
  const {data,error}=await supabase.from("enrollments").insert({class_id:classId,student_id:studentId}).select("id,class_id,student_id").single();
  if(error){const e=databaseError(error);return res.status(e.status).json({error:e.status===409?"This student is already enrolled in that class.":e.message});}res.status(201).json({enrollment:data});
}));
module.exports=router;
