const jwt = require("jsonwebtoken");

const SECRET = "CHANGE_THIS_SECRET";

function authenticate(req,res,next){

const token = req.headers.authorization;

if(!token){
return res.status(401).send("No token");
}

try{

const decoded = jwt.verify(token,SECRET);

req.user = decoded;

next();

}catch{

res.status(401).send("Invalid token");

}

}

module.exports = authenticate;