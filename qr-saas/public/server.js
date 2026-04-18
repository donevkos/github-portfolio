// ===== IMPORTS =====

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const session = require("express-session");

const Stripe = require("stripe");
const nodemailer = require("nodemailer");


// ===== CONFIG =====

const app = express();
const PORT = 3000;

const SECRET = "CHANGE_THIS_SECRET";

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";
const GOOGLE_CLIENT_SECRET = "YOUR_GOOGLE_CLIENT_SECRET";

const stripe = Stripe("YOUR_STRIPE_SECRET_KEY");


// ===== EMAIL =====

const transporter = nodemailer.createTransport({

service:"gmail",

auth:{
user:"YOUR_EMAIL@gmail.com",
pass:"YOUR_APP_PASSWORD"
}

});


// ===== MIDDLEWARE =====

app.use(express.json());
app.use(express.urlencoded({ extended:true }));
app.use(express.static("public"));

app.use(session({
secret:"sessionsecret",
resave:false,
saveUninitialized:false
}));

app.use(passport.initialize());
app.use(passport.session());


// ===== DATABASE =====

const db = new sqlite3.Database("database.db");

db.serialize(()=>{

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
email TEXT UNIQUE,
password TEXT,
plan TEXT DEFAULT 'free'
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS qrcodes(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER,
code TEXT UNIQUE,
target_url TEXT,
scans INTEGER DEFAULT 0
)
`);

});


// ===== PASSPORT =====

passport.serializeUser((user,done)=>{
done(null,user.id);
});

passport.deserializeUser((id,done)=>{
db.get("SELECT * FROM users WHERE id=?",[id],(err,user)=>{
done(err,user);
});
});


// ===== GOOGLE LOGIN =====

passport.use(new GoogleStrategy({

clientID:GOOGLE_CLIENT_ID,
clientSecret:GOOGLE_CLIENT_SECRET,
callbackURL:"/auth/google/callback"

},
(accessToken,refreshToken,profile,done)=>{

const email=profile.emails[0].value;

db.get("SELECT * FROM users WHERE email=?",[email],(err,user)=>{

if(user) return done(null,user);

db.run(
"INSERT INTO users(email,password) VALUES(?,?)",
[email,"google"],
function(){

db.get(
"SELECT * FROM users WHERE id=?",
[this.lastID],
(err,newUser)=>done(err,newUser)
);

}
);

});

}
));


// ===== AUTH =====

function authenticate(req,res,next){

const token=req.headers.authorization;

if(!token) return res.status(401).send("No token");

try{

const decoded=jwt.verify(token,SECRET);

req.user=decoded;

next();

}catch{

res.status(401).send("Invalid token");

}

}


// ===== REGISTER =====

app.post("/api/register",async(req,res)=>{

const {email,password}=req.body;

const hash=await bcrypt.hash(password,10);

db.run(
"INSERT INTO users(email,password) VALUES(?,?)",
[email,hash],
function(err){

if(err) return res.status(400).send("User exists");

const token=jwt.sign({id:this.lastID},SECRET);

transporter.sendMail({

from:"QR SaaS",
to:email,
subject:"Welcome",
text:"Your QR SaaS account is ready!"

});

res.json({token});

}
);

});


// ===== LOGIN =====

app.post("/api/login",(req,res)=>{

const {email,password}=req.body;

db.get("SELECT * FROM users WHERE email=?",[email],async(err,user)=>{

if(!user) return res.status(400).send("User not found");

if(user.password==="google")
return res.status(400).send("Use Google login");

const valid=await bcrypt.compare(password,user.password);

if(!valid) return res.status(400).send("Wrong password");

const token=jwt.sign({id:user.id},SECRET);

res.json({token});

});

});


// ===== GOOGLE ROUTES =====

app.get("/auth/google",
passport.authenticate("google",{scope:["profile","email"]})
);

app.get("/auth/google/callback",
passport.authenticate("google",{failureRedirect:"/login.html"}),
(req,res)=>{

const token=jwt.sign({id:req.user.id},SECRET);

res.redirect("/dashboard.html?token="+token);

}
);


// ===== CREATE QR =====

app.post("/api/create",authenticate,async(req,res)=>{

const {text}=req.body;

const code=uuidv4().slice(0,8);

db.run(
"INSERT INTO qrcodes(user_id,code,target_url) VALUES(?,?,?)",
[req.user.id,code,text]
);

const short=`http://localhost:${PORT}/r/${code}`;

const qr=await QRCode.toDataURL(short);

res.json({qr,shortURL:short});

});


// ===== REDIRECT =====

app.get("/r/:code",(req,res)=>{

const code=req.params.code;

db.get(
"SELECT * FROM qrcodes WHERE code=?",
[code],
(err,qr)=>{

if(!qr) return res.send("QR not found");

db.run(
"UPDATE qrcodes SET scans=scans+1 WHERE id=?",
[qr.id]
);

res.redirect(qr.target_url);

}
);

});


// ===== ANALYTICS =====

app.get("/api/analytics",authenticate,(req,res)=>{

db.all(
"SELECT code,target_url,scans FROM qrcodes WHERE user_id=?",
[req.user.id],
(err,rows)=>{

let total=0;

rows.forEach(r=>total+=r.scans);

res.json({
totalScans:total,
qrs:rows
});

}
);

});


// ===== STRIPE SUBSCRIPTION =====

app.post("/api/create-checkout-session",authenticate,async(req,res)=>{

const session=await stripe.checkout.sessions.create({

payment_method_types:["card"],

mode:"subscription",

line_items:[{

price_data:{
currency:"usd",
product_data:{
name:"QR SaaS Pro Plan"
},
unit_amount:900,
recurring:{interval:"month"}
},

quantity:1

}],

success_url:"http://localhost:3000/dashboard.html?success=true",

cancel_url:"http://localhost:3000/pricing.html"

});

res.json({url:session.url});

});


// ===== START SERVER =====

app.listen(PORT,()=>{
console.log("Server running on http://localhost:"+PORT);
});