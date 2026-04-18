const express = require("express");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");

const db = require("./database");
const authenticate = require("./auth");

const router = express.Router();


// CREATE QR
router.post("/create", authenticate, async (req,res)=>{

const {text} = req.body;

const code = uuidv4().slice(0,8);

db.run(
"INSERT INTO qrcodes(user_id,code,target_url) VALUES(?,?,?)",
[
req.user.id,
code,
text
]
);

const shortURL = `http://localhost:3000/r/${code}`;

const qr = await QRCode.toDataURL(shortURL);

res.json({
qr,
shortURL
});

});


// REDIRECT
router.get("/r/:code",(req,res)=>{

const code = req.params.code;

db.get(
"SELECT * FROM qrcodes WHERE code=?",
[code],
(err,row)=>{

if(!row){
return res.send("QR not found");
}

db.run(
"UPDATE qrcodes SET scans=scans+1 WHERE id=?",
[row.id]
);

res.redirect(row.target_url);

});

});


module.exports = router;