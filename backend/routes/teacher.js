const express=require("express");
const supabase=require("../supabase");
const {asyncRoute,validUUID,validDate}=require("../utils/errors");
const router=express.Router();const run=asyncRoute;
async function assignedClass(classId,userId){const r=await supabase.from("classes").select("id,name,code").eq("id",classId).eq("teacher_id",userId).maybeSingle();if(r.error)throw r.error;return r.data;}
router.get("/classes",run(async(req,res)=>{
 const c=await supabase.from("classes").select("id,name,code").eq("teacher_id",req.user.id).order("name");if(c.error)throw c.error;
 const ids=c.data.map(x=>x.id);let counts={},recordCount=0;
 if(ids.length){const e=await supabase.from("enrollments").select("class_id").in("class_id",ids);if(e.error)throw e.error;for(const row of e.data)counts[row.class_id]=(counts[row.class_id]||0)+1;
 const a=await supabase.from("attendance_records").select("id",{count:"exact",head:true}).in("class_id",ids);if(a.error)throw a.error;recordCount=a.count||0;}
 res.json({classes:c.data.map(x=>({...x,student_count:counts[x.id]||0})),record_count:recordCount});
}));
router.get("/classes/:id/attendance",run(async(req,res)=>{
 const classId=req.params.id,date=req.query.date;
 if(!validUUID(classId))return res.status(400).json({error:"Invalid class ID."});
 if(!validDate(date)||date>new Date().toISOString().slice(0,10))return res.status(400).json({error:"Choose a valid date that is not in the future."});
 const c=await assignedClass(classId,req.user.id);if(!c)return res.status(404).json({error:"Assigned class not found."});
 const e=await supabase.from("enrollments").select("student_id,student:app_users!enrollments_student_id_fkey(id,name,email,student_number)").eq("class_id",classId);if(e.error)throw e.error;
 const a=await supabase.from("attendance_records").select("student_id,status").eq("class_id",classId).eq("attendance_date",date);if(a.error)throw a.error;
 const statusMap=Object.fromEntries(a.data.map(x=>[x.student_id,x.status]));
 res.json({class:c,date,students:e.data.map(x=>({id:x.student.id,name:x.student.name,email:x.student.email,student_number:x.student.student_number,status:statusMap[x.student_id]||null}))});
}));
router.put("/classes/:id/attendance",run(async(req,res)=>{
 const classId=req.params.id;const {date,records}=req.body;
 if(!validUUID(classId))return res.status(400).json({error:"Invalid class ID."});
 if(!validDate(date)||date>new Date().toISOString().slice(0,10))return res.status(400).json({error:"Choose a valid date that is not in the future."});
 if(!Array.isArray(records)||records.length>500)return res.status(400).json({error:"Attendance records must be a list of at most 500 students."});
 if(records.some(r=>!r||!validUUID(r.student_id)||!["Present","Absent"].includes(r.status))||new Set(records.map(r=>r.student_id)).size!==records.length)return res.status(400).json({error:"Each student must have one valid Present or Absent status."});
 const c=await assignedClass(classId,req.user.id);if(!c)return res.status(404).json({error:"Assigned class not found."});
 const enrolled=await supabase.from("enrollments").select("student_id").eq("class_id",classId);if(enrolled.error)throw enrolled.error;
 const enrolledSet=new Set(enrolled.data.map(x=>x.student_id));if(records.some(r=>!enrolledSet.has(r.student_id)))return res.status(400).json({error:"Attendance can only be recorded for students enrolled in this class."});
 const rows=records.map(r=>({class_id:classId,student_id:r.student_id,attendance_date:date,status:r.status,marked_by:req.user.id}));
 if(rows.length){const result=await supabase.from("attendance_records").upsert(rows,{onConflict:"class_id,student_id,attendance_date"});if(result.error)throw result.error;}
 res.json({message:"Attendance saved.",date,records_saved:rows.length});
}));
module.exports=router;
