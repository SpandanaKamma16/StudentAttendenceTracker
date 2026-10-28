const express=require("express");
const supabase=require("../supabase");
const {asyncRoute}=require("../utils/errors");
const router=express.Router();const run=asyncRoute;
router.get("/summary",run(async(req,res)=>{
 const enroll=await supabase.from("enrollments").select("class_id,class:classes!enrollments_class_id_fkey(id,name,code)").eq("student_id",req.user.id);if(enroll.error)throw enroll.error;
 const ids=enroll.data.map(x=>x.class_id);let records=[];
 if(ids.length){const r=await supabase.from("attendance_records").select("class_id,attendance_date,status").eq("student_id",req.user.id).in("class_id",ids).order("attendance_date",{ascending:false});if(r.error)throw r.error;records=r.data;}
 const counts={};for(const id of ids)counts[id]={present:0,total:0};
 for(const r of records){if(!counts[r.class_id])continue;counts[r.class_id].total++;if(r.status==="Present")counts[r.class_id].present++;}
 const classes=enroll.data.map(e=>{const c=counts[e.class_id];return{id:e.class.id,name:e.class.name,code:e.class.code,present:c.present,total:c.total,percentage:c.total?c.present/c.total*100:0};});
 const total=classes.reduce((n,c)=>n+c.total,0),present=classes.reduce((n,c)=>n+c.present,0);
 const classNames=Object.fromEntries(enroll.data.map(e=>[e.class_id,e.class.name]));
 res.json({classes,overall:{present,total,percentage:total?present/total*100:0},recent:records.slice(0,12).map(r=>({attendance_date:r.attendance_date,class_name:classNames[r.class_id]||"Class",status:r.status}))});
}));
module.exports=router;
