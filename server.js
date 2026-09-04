const express = require("express");
const path = require("path");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();
const auth = admin.auth();

app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname, "public")));

const ownerEmails = () => (process.env.ADMIN_EMAILS || "")
  .split(",").map(x => x.trim().toLowerCase()).filter(Boolean);

async function token(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) throw new Error("Missing bearer token");
  return auth.verifyIdToken(h.slice(7));
}
async function requireUser(req,res,next) {
  try { req.user = await token(req); next(); }
  catch(e) { res.status(401).json({error:"Login required"}); }
}
async function requireOwner(req,res,next) {
  try {
    req.user = await token(req);
    if (!req.user.email || !ownerEmails().includes(req.user.email.toLowerCase()))
      return res.status(403).json({error:"Owner access required"});
    next();
  } catch(e) { res.status(401).json({error:"Owner login required"}); }
}
async function requireSitterOrOwner(req,res,next) {
  try {
    req.user = await token(req);
    const claims = req.user;
    const isOwner = claims.email && ownerEmails().includes(claims.email.toLowerCase());
    if (!isOwner && claims.role !== "sitter")
      return res.status(403).json({error:"Sitter access required"});
    req.isOwner = !!isOwner;
    next();
  } catch(e) { res.status(401).json({error:"Login required"}); }
}

app.get("/api/me", requireUser, async (req,res) => {
  const email = (req.user.email || "").toLowerCase();
  res.json({ok:true, isOwner: ownerEmails().includes(email), role:req.user.role || null});
});

app.get("/api/config", (req,res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  });
});

app.post("/api/bookings", async (req,res) => {
  try {
    const b = req.body;
    const required = ["parentName","phone","childCount","childAges","date","startTime","endTime","address"];
    if (required.some(k => !b[k])) return res.status(400).json({error:"Please complete all required fields."});
    const start = new Date(`${b.date}T${b.startTime}`);
    const end = new Date(`${b.date}T${b.endTime}`);
    let hours = (end-start)/3600000;
    if (hours <= 0) hours += 24;
    const total = Number((hours*15).toFixed(2));
    const data = {
      parentName:b.parentName, phone:b.phone, email:b.email||"",
      childCount:Number(b.childCount), childAges:b.childAges,
      date:b.date, startTime:b.startTime, endTime:b.endTime,
      address:b.address, notes:b.notes||"",
      paymentMethod:b.paymentMethod||"",
      estimatedTotal:total, deposit:100,
      depositStatus:"required", paymentStatus:"unpaid",
      status:"pending", sitterId:"", sitterName:"",
      sitterNotes:"", ownerNotes:"",
      createdAt:admin.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection("bookings").add(data);
    res.json({ok:true, bookingId:ref.id, estimatedTotal:total});
  } catch(e) { console.error(e); res.status(500).json({error:"Could not submit booking request."}); }
});

app.get("/api/bookings", requireOwner, async (req,res) => {
  const snap = await db.collection("bookings").orderBy("createdAt","desc").get();
  res.json({bookings:snap.docs.map(d=>({id:d.id,...d.data()}))});
});

app.patch("/api/bookings/:id", requireOwner, async (req,res) => {
  const allowed = ["status","sitterId","sitterName","depositStatus","paymentStatus","sitterNotes","ownerNotes"];
  const update={};
  allowed.forEach(k=>{if(k in req.body) update[k]=req.body[k]});
  update.updatedAt=admin.firestore.FieldValue.serverTimestamp();
  await db.collection("bookings").doc(req.params.id).update(update);
  res.json({ok:true});
});

app.delete("/api/bookings/:id", requireOwner, async (req,res) => {
  await db.collection("bookings").doc(req.params.id).delete();
  res.json({ok:true});
});

app.get("/api/sitter/bookings", requireSitterOrOwner, async (req,res) => {
  const snap = await db.collection("bookings").orderBy("createdAt","desc").get();
  let rows=snap.docs.map(d=>({id:d.id,...d.data()}));
  if (!req.isOwner) rows=rows.filter(b => b.sitterId === req.user.uid);
  res.json({bookings:rows});
});

app.get("/api/sitters", requireOwner, async (req,res) => {
  const snap=await db.collection("sitters").orderBy("createdAt","desc").get();
  res.json({sitters:snap.docs.map(d=>({id:d.id,...d.data()}))});
});

app.post("/api/owner/create-sitter", requireOwner, async (req,res) => {
  try {
    const {email,password,displayName,phone=""}=req.body;
    if(!email||!password||!displayName) return res.status(400).json({error:"Name, email and password are required."});
    if(password.length<8) return res.status(400).json({error:"Password must be at least 8 characters."});
    const user=await auth.createUser({email,password,displayName});
    await auth.setCustomUserClaims(user.uid,{role:"sitter"});
    await db.collection("sitters").doc(user.uid).set({
      displayName,email,phone,role:"sitter",active:true,
      createdAt:admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ok:true,uid:user.uid});
  } catch(e) { res.status(400).json({error:e.message||"Could not create sitter."}); }
});

app.patch("/api/owner/sitters/:id", requireOwner, async (req,res) => {
  const {active}=req.body;
  await db.collection("sitters").doc(req.params.id).update({active:!!active});
  try { await auth.updateUser(req.params.id,{disabled:!active}); } catch(e){}
  res.json({ok:true});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Babysitting Services running on port ${PORT}`));