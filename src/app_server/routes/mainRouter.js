var express = require('express');
var router = express.Router();
var  ctrlMain = require('../Controllers/mainController');
var  ctrlConfig = require('../Controllers/config');
var  ctrlMongo = require('../Controllers/mongohandler');
const Prometheus = require('prom-client');
var session = require('express-session');
const swaggerUi = require('swagger-ui-express'),
    swaggerdoc = require("../../Zebra_Swagger.json");

require('dotenv').config();
const bcrypt = require('bcryptjs')
var nedb = require("../../nedbAdmin")
const jwt = require("jsonwebtoken")
let db = nedb.db;
let dbrefresh = nedb.dbrefresh;
var  Auth = require('../../Auth');
const path = require('path');
const fs = require('fs');
//var Zconfig;
try{
  var Zconfig = require("../../config/Zconfig.json");
}catch(e){
  var Zconfig = {};
}
let grafanabaseurl = Zconfig.grafanaurl;
let grafanabaseport = Zconfig.grafanaport;
let grafanahttptype = Zconfig.grafanahttptype;
const axios = require('axios');
const { send } = require('process');
const grafanaServer = `${grafanahttptype}://${grafanabaseurl}:${grafanabaseport}`


function parameters(fn){
  parms = {
    ddsbaseurl: Zconfig.ddsbaseurl,
    ddsbaseport: Zconfig.ddsbaseport,
    rmf3filename: Zconfig.rmf3filename,
    rmfppfilename: Zconfig.rmfppfilename,
    mvsResource: Zconfig.mvsResource,
    mongourl: Zconfig.mongourl,
    dbinterval: Zconfig.dbinterval,
    dbname: Zconfig.dbname,
    appurl: Zconfig.appurl,
    appport: Zconfig.appport,
    mongoport: Zconfig.mongoport,
    ppminutesInterval: Zconfig.ppminutesInterval,
    rmf3interval: Zconfig.rmf3interval,
    httptype: Zconfig.httptype,
    useDbAuth: Zconfig.useDbAuth,
    dbUser: Zconfig.dbUser,
    dbPassword: Zconfig.dbPassword,
    authSource: Zconfig.authSource,
    useMongo: Zconfig.useMongo,
    usePrometheus: Zconfig.usePrometheus,
    https: Zconfig.https,
    grafanaurl: Zconfig.grafanaurl,
    grafanaport: Zconfig.grafanaport
  }
  fn(parms); //return the parameters
}

// Checks if user login session is available in browser
var sessionChecker = (req, res, next) => {
  if (req.session.name && req.cookies.user_sid) { //If user login session is available
      next()
  } else { 
      req.session.redirectUrl = req.url;
      res.redirect("/log_in") //redirect to login page if user is not logged in
  }    
};

function ddsparm(fn){
  fn(Zconfig.dds); //return the parameters
}


router.post('/updateconfig', ctrlConfig.updateconfig);

router.post('/updatedds', ctrlConfig.updatedds);

router.post('/deletedds', ctrlConfig.deletedds);

router.post('/savedds', Auth.authenticateFormToken, ctrlConfig.savedds);

router.get('/createZconfig', ctrlConfig.createZconfig);

router.get('/setting', sessionChecker, (req, res) => {
  if(Object.keys(Zconfig).length === 0){
    res.render("settings",{msg: "No Zconfig"});
  }else{
    res.render("settings");
  } 
});

router.get('/ddsconfig', (req, res) => {
  //console.log(Zconfig.dds["RPRT"])
  res.render("ddsconfig", {dds: Zconfig.dds});
})

router.get('/otherconfig', (req, res) => {
  res.render("otherconfig", {fparms:Zconfig});
})

/*
// render the setting page


router.get('/zsetting', (req, res) => {
  res.render("zsetting");
});

router.get('/ddssetting', (req, res) => {
  res.render("ddssetting");
});

//addsetting 
router.post('/addsetting', Auth.authenticateFormToken,  ctrlMain.addFormSettings) //call addsetting function in maincontroller

router.get('/settings', Auth.authenticateToken, ctrlMain.settings) // call settings function

router.post('/addsettings', Auth.authenticateToken,  ctrlMain.addSettings) //call add settings function



router.get('/setting', sessionChecker, (req, res) => {
  Auth.formToken(req.session.name, function(data){ //Authenticate user
    if (data.Access){ // if data returned by the auhentication function contains an Access parameter
      parameters(function(parms){ //get Zconfig parameters
       res.render("settings", {fdata: data, fparms:parms}); // render the setting page with Access token and Zconfig parameters
      })
    }else{
      res.send(data)
    }
  })
});

 

*/


// Zebra API ML cookie checker
router.get('/apimlcookie',  function(req, res, next){
  if (req.cookies.apimlAuthenticationToken == undefined){
    res.send("No Cookie");
  }else{
    res.send(req.cookies.apimlAuthenticationToken);
  }
})

router.post('/apimllogin',  function(req, res, next){
  axios.post('https://localhost:10010/api/v1/gateway/auth/login', {
    "username": req.body.username,
    "password": req.body.password
  })
  .then(function (response) {
    if(response.headers["set-cookie"]){
      var res_head = response.headers["set-cookie"][0].split("=");
      var token_split = res_head[1].split(";");
      var token = token_split[0];
      res.send(token);
    }else{
      res.send("error");
    }
  })
  .catch(function (error) {
    res.send("error");
  });
})

// Zebra UI routers

// router for getting new Access token using the refresh token on the UI Page
router.post("/refreshT", sessionChecker, (req, res) => {
   Auth.formRefreshToken(req.body.refresh, req.session.name, function(data){ //Authenticate refresh token
     if (data.Access){ // if data returned by the auhentication function contains an Access parameter
       parameters(function(parms){ //get Zconfig parameters
        res.render("settings", {fdata: data, fparms:parms}); // render the setting page with Access token and Zconfig parameters
       })
     }else{
       res.send(data)
     }
   })
})

//render swagger document
router.use('/apis', swaggerUi.serve, swaggerUi.setup(swaggerdoc));

// redirect to grafana server
router.get('/grafana',  function(req, res, next){
  res.redirect(grafanaServer);
})

// render files from /upload directory
router.get('/files', (req, res) => {
  const directoryPath = path.join(__dirname, '../../uploads');
  fs.readdir(directoryPath, function (err, files) {
    //handling error
    if (err) {
        res.send('Unable to scan uploads directory: ' + err);
    } 
    res.render("files", {resfiles: files});
  });
   
});

// render the mongoDB access page
router.get('/mongo', (req, res) => {
  res.render("mongot");
});

// logout routine
router.use("/log_out", (req, res, next) => {
  if (req.cookies.user_sid && !req.session.user) { // if cookie is available
      res.clearCookie('user_sid'); // delete cookie
  }
  //res.clearCookie()
  res.redirect("/") //redirect to homepage
});

//render the about page
router.get("/about", (req, res)=> {
  res.render("about");
})

//render the login page and authorise login
router.route('/log_in')
  .get((req, res) => {
    res.render("login");
  })
  .post(Auth.formLogin); // authorise user credentials

// handle mongoDB data request
router.post('/mongo', ctrlMongo.mongoReport);

//handes Password change using Zebra UI
router.post("/UpdatePasswordForm", Auth.updatePasswordForm)



/* Main Controller Router. */
router.get('/',  ctrlMain.home) // Call home function
router.get('/api-doc',  function(req, res, next){
  res.json(swaggerdoc);
})

router.get('/prommetric', (req, res) => {
    res.end(Prometheus.register.metrics()); //display metrics in prom-client register
});

router.post("/login", Auth.login) 

router.post("/UpdatePassword", Auth.authenticateToken, Auth.updatePassword)

router.post("/token", Auth.token)

router.get("/users", Auth.authenticateToken, (req,res) =>{
  db.find({ }, function (err, users) {
      res.json(users); // logs all of the data in docs
  });
})

router.get("/logout", Auth.authenticateToken, (req,res) => {
  dbrefresh.remove({}, {multi: true}, err => {
      if (err) {
      }else{
          res.status(200).send("Done!!!!");
      }
  });
})


module.exports = router;
 